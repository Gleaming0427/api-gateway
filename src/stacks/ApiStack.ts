/**
 * API Gateway HA infrastructure stack.
 * Creates: DynamoDB Table, Lambda proxy, REST API Gateway.
 * Production adds: Lambda authorizer + JWT secrets + custom domain.
 */
export function createApiStack() {
  const isProd = $app.stage === "production";

  // ── Secrets ──────────────────────────────────────────────────────────
  const upstreamApiUrl = new sst.Secret("UpstreamApiUrl");

  // ── DynamoDB Table ───────────────────────────────────────────────────
  const rateLimitTable = new sst.aws.Dynamo("RateLimitTable", {
    fields: { pk: "string" },
    primaryIndex: { hashKey: "pk" },
  });

  // ── API Gateway REST API ─────────────────────────────────────────────
  const domain = isProd
    ? { name: `api.${$app.name}.com`, dns: sst.aws.dns() }
    : undefined;

  const api = new sst.aws.ApiGatewayV1("ApiGateway", {
    cors: true,
    accessLog: { retention: "1 month" },
    domain,
    endpoint: { type: "regional" },
  });

  // ── Proxy route (both staging and production) ────────────────────────
  // The route config object passes link/permissions/env directly to the
  // auto-created Lambda, avoiding the need for a separate Function resource.

  const proxyRoute = {
    handler: "src/functions/gateway/proxy.handler" as const,
    link: [upstreamApiUrl, rateLimitTable],
    environment: {
      RATE_LIMIT_CAPACITY: "100",
      RATE_LIMIT_REFILL_RATE: "10",
      // Set via `sst secret set StagingToken <token> --stage staging`
      // If empty, the staging proxy is open (local dev convenience).
      STAGING_TOKEN: "",
    },
    permissions: [
      {
        actions: ["dynamodb:GetItem", "dynamodb:PutItem"],
        resources: [rateLimitTable.arn],
      },
    ],
    logging: { retention: "1 month" as const },
  };

  // ── Auth (production only) ───────────────────────────────────────────
  if (isProd) {
    const jwksUrl = new sst.Secret("JwksUrl");
    const jwtIssuer = new sst.Secret("JwtIssuer");
    const jwtAudience = new sst.Secret("JwtAudience");

    const authorizerFn = new sst.aws.Function("AuthorizerFunction", {
      handler: "src/functions/auth/authorizer.handler",
      runtime: "nodejs22.x",
      architecture: "arm64",
      memory: "512 MB",
      timeout: "10 seconds",
      link: [jwksUrl, jwtIssuer, jwtAudience],
      logging: { retention: "1 month" },
    });

    const tokenAuthorizer = api.addAuthorizer({
      name: "TokenAuthorizer",
      tokenFunction: authorizerFn,
      ttl: 300,
      identitySource: "method.request.header.Authorization",
    });

    api.route("ANY /{proxy+}", proxyRoute, {
      auth: { custom: { id: tokenAuthorizer.id } },
    });
  } else {
    api.route("ANY /{proxy+}", proxyRoute);
  }

  api.deploy();
}

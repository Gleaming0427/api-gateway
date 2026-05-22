/**
 * API Gateway HA infrastructure stack.
 * Staging: Lambda Function URL (direct, no auth, fast to test).
 * Production: REST API Gateway with JWT authorizer + custom domain.
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

  // ── Lambda Proxy ─────────────────────────────────────────────────────
  // Explicit Function (not api.route) so link and environment are guaranteed
  // to be injected by SST. SST's api.route creates a wrapper Lambda that
  // does NOT inherit link/env from the handler config object.

  const gatewayFn = new sst.aws.Function("GatewayFunction", {
    handler: "src/functions/gateway/proxy.handler",
    runtime: "nodejs22.x",
    architecture: "arm64",
    memory: "512 MB",
    timeout: "30 seconds",
    link: [upstreamApiUrl, rateLimitTable],
    environment: {
      RATE_LIMIT_CAPACITY: "100",
      RATE_LIMIT_REFILL_RATE: "10",
      STAGING_TOKEN: "",
    },
    permissions: [
      {
        actions: ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"],
        resources: [rateLimitTable.arn],
      },
    ],
    url: !isProd, // Staging: direct Function URL. Production: API Gateway handles routing.
    logging: { retention: "1 month" },
  });

  // ── Staging: return early (Function URL is enough) ───────────────────

  if (!isProd) return;

  // ── Production: API Gateway + Authorizer ─────────────────────────────

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
    environment: {
      MAX_TOKEN_AGE: "86400", // 24h — reject tokens older than this regardless of exp
    },
    logging: { retention: "1 month" },
  });

  const api = new sst.aws.ApiGatewayV1("ApiGateway", {
    cors: true,
    accessLog: { retention: "1 month" },
    domain: { name: `api.${$app.name}.com`, dns: sst.aws.dns() },
    endpoint: { type: "regional" },
  });

  const tokenAuthorizer = api.addAuthorizer({
    name: "TokenAuthorizer",
    tokenFunction: authorizerFn,
    ttl: 300,
    identitySource: "method.request.header.Authorization",
  });

  api.route("ANY /{proxy+}", gatewayFn, {
    auth: { custom: { id: tokenAuthorizer.id } },
  });

  api.deploy();
}

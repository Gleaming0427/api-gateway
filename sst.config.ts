/**
 * SST Ion configuration for API Gateway HA.
 *
 * Multi-region strategy:
 * - Primary deployment targets eu-west-1.
 * - DynamoDB is a Global Table with replicas in eu-west-1 + us-east-1.
 * - For full multi-region (API Gateway in both regions), deploy twice:
 *   `sst deploy --stage production-eu` (default) + `sst deploy --stage production-us`
 *   with `--region us-east-1` and Route 53 latency-based routing across both.
 * - The staging deployment uses a single region (eu-west-1).
 */
export default $config({
  app(_input) {
    return {
      name: "api-gateway-ha",
      home: "aws",
      providers: {
        aws: {
          region: "eu-west-1",
        },
      },
    };
  },

  async run() {
    const { createApiStack } = await import("./src/stacks/ApiStack");
    createApiStack();
  },
});

/**
 * Minimal ambient type declarations for the SST Ion global namespace.
 * The real types are injected by the SST CLI at deploy/dev time.
 * This file provides just enough types for tsc --noEmit to pass.
 */

/* eslint-disable @typescript-eslint/no-extraneous-class */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */

declare const $app: {
  name: string;
  stage: string;
};

declare function $config(config: {
  app(input: { stage: string }): {
    name: string;
    home: "aws";
    providers: Record<string, { region: string }>;
  };
  run(): Promise<void>;
}): unknown;

declare namespace sst {
  namespace aws {
    class Function {
      constructor(
        name: string,
        args: {
          handler: string;
          runtime?: string;
          memory?: string;
          timeout?: string;
          architecture?: "x86_64" | "arm64";
          environment?: Record<string, string>;
          link?: unknown[];
          permissions?: Array<{
            actions: string[];
            resources: string[];
          }>;
          nodejs?: { install?: string[]; format?: string };
          logging?: { retention: string };
          url?: boolean | { authorization: string; cors?: unknown };
        },
      );
    }

    class Dynamo {
      readonly name: string;
      readonly arn: string;
      constructor(
        name: string,
        args: {
          fields: Record<string, "string" | "number" | "binary">;
          primaryIndex: { hashKey: string; rangeKey?: string };
          globalIndexes?: Record<
            string,
            {
              hashKey: string;
              rangeKey?: string;
              projection?: string | string[];
            }
          >;
          ttl?: string;
          stream?: string;
          transform?: {
            table?: (args: Record<string, unknown>) => void;
          };
        },
      );
    }

    class ApiGatewayV1 {
      readonly url: string;
      constructor(
        name: string,
        args?: {
          cors?: boolean;
          domain?: {
            name: string;
            cert?: string;
            dns?: unknown | false;
            path?: string;
          };
          accessLog?: { retention: string } | boolean;
          endpoint?: { type: "edge" | "regional" | "private" };
        },
      );
      route(
        pattern: string,
        handler: string | Function,
        args?: {
          auth?:
            | { iam: boolean }
            | { custom: { id: string } };
          apiKey?: boolean;
        },
      ): void;
      addAuthorizer(args: {
        name: string;
        tokenFunction: string | Function;
        ttl?: number;
        identitySource?: string;
      }): { id: string };
      deploy(): void;
    }

    function dns(): unknown;
  }

  class Secret {
    readonly value: string;
    constructor(name: string);
  }
}

// Pulumi AWS provider used when configuring multi-region
declare class aws {
  static Provider: new (
    name: string,
    args: { region: string },
  ) => unknown;
}




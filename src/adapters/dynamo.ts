/**
 * DynamoDB adapter for RateLimiterStore. Atomic get/set against a DynamoDB table.
 * Template-only — not shipped in the npm package.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import type { RateLimiterStore, BucketState } from "../core/rate-limiter";

/** Implements RateLimiterStore backed by DynamoDB. Uses on-demand capacity, keyed by pk = apiKeyId. */
export class DynamoRateLimiterStore implements RateLimiterStore {
  private client: DynamoDBDocumentClient;
  private tableName: string;

  constructor(tableName: string, client?: DynamoDBDocumentClient) {
    this.tableName = tableName;
    this.client =
      client ??
      DynamoDBDocumentClient.from(new DynamoDBClient({}), {
        marshallOptions: { removeUndefinedValues: true },
      });
  }

  /** Reads the bucket state for the given key. Returns null when the item does not exist (first request). */
  async get(key: string): Promise<BucketState | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: key },
        ConsistentRead: true,
      }),
    );

    if (!result.Item) return null;

    return {
      tokens: result.Item.tokens as number,
      lastRefill: result.Item.lastRefill as number,
    };
  }

  /** Writes the bucket state. Uses PutCommand — last-write-wins, accepting rare over-consumption under concurrency. */
  async set(key: string, state: BucketState): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: key,
          tokens: state.tokens,
          lastRefill: state.lastRefill,
        },
      }),
    );
  }
}

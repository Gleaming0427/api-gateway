/**
 * DynamoDB adapter for RateLimiterStore. Atomic get/set against a DynamoDB table.
 * Template-only — not shipped in the npm package.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { RateLimiterStore, BucketState, ConsumeResult } from "../core/rate-limiter";

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

  /** Writes the bucket state. Prefer atomicConsume to prevent TOCTOU race conditions under concurrency. */
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

  /** Atomic consume using UpdateItem with optimistic locking. Prevents TOCTOU race conditions by checking that the token count hasn't changed since we read it. Returns null when the condition fails (caller should retry). */
  async atomicConsume(
    key: string,
    tokens: number,
    capacity: number,
    refillRate: number,
  ): Promise<ConsumeResult | null> {
    const existing = await this.get(key);
    const now = Date.now();

    const refilled =
      existing === null
        ? capacity
        : Math.min(
            capacity,
            existing.tokens +
              ((now - existing.lastRefill) / 1000) * refillRate,
          );

    if (refilled < tokens) {
      const tokensMissing = tokens - refilled;
      const retryAfter =
        refillRate > 0 ? tokensMissing / refillRate : Infinity;

      // Still persist the refilled state, but only if no concurrent write happened
      try {
        await this.client.send(
          new UpdateCommand({
            TableName: this.tableName,
            Key: { pk: key },
            UpdateExpression: "SET tokens = :tokens, lastRefill = :now",
            ConditionExpression: existing === null
              ? "attribute_not_exists(pk)"
              : "tokens = :expected",
            ExpressionAttributeValues: {
              ":tokens": refilled,
              ":now": now,
              ...(existing !== null ? { ":expected": existing.tokens } : {}),
            },
          }),
        );
      } catch (err) {
        if (
          err instanceof Error &&
          err.name === "ConditionalCheckFailedException"
        ) {
          return null;
        }
        throw err;
      }

      return { allowed: false, remaining: 0, retryAfter };
    }

    const newTokens = refilled - tokens;

    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: key },
          UpdateExpression: "SET tokens = :tokens, lastRefill = :now",
          ConditionExpression: existing === null
            ? "attribute_not_exists(pk)"
            : "tokens = :expected",
          ExpressionAttributeValues: {
            ":tokens": newTokens,
            ":now": now,
            ...(existing !== null ? { ":expected": existing.tokens } : {}),
          },
        }),
      );
    } catch (err) {
      if (
        err instanceof Error &&
        err.name === "ConditionalCheckFailedException"
      ) {
        return null;
      }
      throw err;
    }

    return { allowed: true, remaining: Math.floor(newTokens) };
  }
}

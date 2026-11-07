import { getRedisClient, getRateLimiterLuaScript } from './redisClient';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  currentCount: number;
  limit: number;
  windowMs: number;
}

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  cost?: number;
  operationId?: string;
}

export class DistributedRateLimiter {
  private static sha: string | null = null;

  /**
   * Check and consume rate limit atomically via Redis Lua script
   */
  public static async checkLimit(
    tenantId: string,
    bucketKey: string,
    options: RateLimitOptions
  ): Promise<RateLimitResult> {
    const redis = getRedisClient();
    const script = getRateLimiterLuaScript();
    const fullKey = `reachinbox:rl:{${tenantId}}:${bucketKey}`;
    const now = Date.now();
    const cost = options.cost || 1;
    const reqId = options.operationId || `${now}:${Math.random().toString(36).substring(2, 9)}`;

    try {
      // Execute Redis EVAL for strict atomicity across concurrent workers
      const result = (await redis.eval(
        script,
        1,
        fullKey,
        now.toString(),
        options.windowMs.toString(),
        options.maxRequests.toString(),
        cost.toString(),
        reqId
      )) as [number, number, number, number];

      const allowed = result[0] === 1;
      const remaining = Number(result[1]);
      const retryAfterMs = Number(result[2]);
      const currentCount = Number(result[3]);

      return {
        allowed,
        remaining,
        retryAfterMs,
        currentCount,
        limit: options.maxRequests,
        windowMs: options.windowMs,
      };
    } catch (err: any) {
      throw new Error(`Redis rate limiting failed: ${err.message}`);
    }
  }

  /**
   * Reset rate limit bucket for a tenant (e.g., during tests or manual admin override)
   */
  public static async reset(tenantId: string, bucketKey: string): Promise<void> {
    const redis = getRedisClient();
    const fullKey = `reachinbox:rl:{${tenantId}}:${bucketKey}`;
    await redis.del(fullKey);
  }
}

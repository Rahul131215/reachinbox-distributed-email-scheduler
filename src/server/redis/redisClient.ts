import Redis, { RedisOptions } from 'ioredis';
import fs from 'fs';
import path from 'path';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

export interface RedisHealthStatus {
  connected: boolean;
  url: string;
  pingMs?: number;
  serverInfo?: Record<string, string>;
  error?: string;
}

let redisInstance: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisInstance) {
    const options: RedisOptions = {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        // Linear backoff up to 2 seconds
        return Math.min(times * 100, 2000);
      },
    };

    redisInstance = new Redis(REDIS_URL, options);

    redisInstance.on('error', (err) => {
      // Log connection error without crashing process
      console.warn(`[Redis] Connection warning: ${err.message}`);
    });

    redisInstance.on('connect', () => {
      console.log(`[Redis] Connected to ${REDIS_URL}`);
    });
  }

  return redisInstance;
}

export async function checkRedisHealth(): Promise<RedisHealthStatus> {
  const startTime = Date.now();
  try {
    const probe = new Redis(REDIS_URL, {
      connectTimeout: 500,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: () => null,
    });
    probe.on('error', () => {
      // Handled to suppress unhandledRejection/unhandledError event
    });
    await probe.connect();
    const pong = await probe.ping();
    await probe.quit().catch(() => {});
    return {
      connected: pong === 'PONG',
      url: REDIS_URL,
      pingMs: Date.now() - startTime,
    };
  } catch (err: any) {
    return {
      connected: false,
      url: REDIS_URL,
      error: err?.message || 'Unable to connect to Redis (connection refused)',
    };
  }
}

// Load Lua script
const luaScriptPath = path.join(process.cwd(), 'src', 'server', 'redis', 'rateLimiter.lua');
let cachedLuaScript: string | null = null;

export function getRateLimiterLuaScript(): string {
  if (!cachedLuaScript) {
    if (fs.existsSync(luaScriptPath)) {
      cachedLuaScript = fs.readFileSync(luaScriptPath, 'utf8');
    } else {
      // Fallback inline script matching rateLimiter.lua
      cachedLuaScript = `
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local windowMs = tonumber(ARGV[2])
        local maxRequests = tonumber(ARGV[3])
        local cost = tonumber(ARGV[4]) or 1
        local reqId = ARGV[5] or (tostring(now) .. ':' .. tostring(math.random(100000, 999999)))
        local clearBefore = now - windowMs
        redis.call('ZREMRANGEBYSCORE', key, '-inf', clearBefore)
        local currentCount = redis.call('ZCARD', key)
        if (currentCount + cost) <= maxRequests then
            redis.call('ZADD', key, now, reqId)
            redis.call('PEXPIRE', key, windowMs)
            return {1, maxRequests - (currentCount + cost), 0, currentCount + cost}
        else
            local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
            local retryAfterMs = 1000
            if oldest and #oldest >= 2 then
                local oldestTime = tonumber(oldest[2])
                retryAfterMs = math.max(1, (oldestTime + windowMs) - now)
            end
            return {0, 0, retryAfterMs, currentCount}
        end
      `;
    }
  }
  return cachedLuaScript;
}

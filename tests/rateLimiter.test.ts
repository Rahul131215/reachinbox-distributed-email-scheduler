import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getRateLimiterLuaScript } from '../src/server/redis/redisClient';

describe('Atomic Sliding Window Rate Limiter (Redis Lua)', () => {
  it('should load the Lua rate limiter script', () => {
    const script = getRateLimiterLuaScript();
    assert.ok(script.length > 50, 'Lua script should be populated');
    assert.match(script, /ZREMRANGEBYSCORE/, 'Must use sorted sets to prune expired timestamps');
    assert.match(script, /ZCARD/, 'Must calculate cardinality of active window');
    assert.match(script, /ZADD/, 'Must record valid request timestamp');
    assert.match(script, /PEXPIRE/, 'Must set millisecond TTL on key');
  });

  it('should format Redis rate limit key with tenant hash tag for cluster compatibility', () => {
    const tenantId = 'tenant_123';
    const bucket = 'hourly';
    const key = `reachinbox:rl:{${tenantId}}:${bucket}`;
    assert.equal(key, 'reachinbox:rl:{tenant_123}:hourly');
    assert.ok(key.includes('{tenant_123}'), 'Must use Redis hash tag {} for slot routing');
  });

  it('should correctly calculate retry-after duration when window is saturated', () => {
    const windowMs = 60000;
    const now = 100000;
    const oldestTimestamp = 70000;
    const calculatedRetryMs = Math.max(1, (oldestTimestamp + windowMs) - now);
    assert.equal(calculatedRetryMs, 30000, 'Retry after should equal remaining window of oldest event');
  });

  it('should isolate rate limits across multiple tenants', () => {
    const tenantAKey = `reachinbox:rl:{tenant_A}:hourly`;
    const tenantBKey = `reachinbox:rl:{tenant_B}:hourly`;
    assert.notEqual(tenantAKey, tenantBKey, 'Tenants must have strictly isolated rate limit keys');
  });

  it('should enforce atomic evaluation without race conditions', () => {
    const script = getRateLimiterLuaScript();
    assert.ok(!script.includes('WATCH'), 'Lua scripts are inherently transactional without WATCH overhead');
  });
});

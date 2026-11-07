-- ReachInbox Atomic Sliding Window Rate Limiter
-- KEYS[1]: Rate limit Redis key (e.g., rl:tenant:{tenantId}:hourly)
-- ARGV[1]: Current timestamp in milliseconds (now)
-- ARGV[2]: Window size in milliseconds (windowMs)
-- ARGV[3]: Maximum allowed requests in the window (maxRequests)
-- ARGV[4]: Cost of current operation (usually 1)
-- ARGV[5]: Unique operation / request identifier

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
    -- Record this request
    redis.call('ZADD', key, now, reqId)
    -- Ensure key automatically expires when window elapses
    redis.call('PEXPIRE', key, windowMs)
    local remaining = maxRequests - (currentCount + cost)
    return {1, remaining, 0, currentCount + cost}
else
    -- Rate limit exceeded: calculate exact millisecond wait time until next slot frees
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local retryAfterMs = 1000
    if oldest and #oldest >= 2 then
        local oldestTime = tonumber(oldest[2])
        retryAfterMs = math.max(1, (oldestTime + windowMs) - now)
    end
    return {0, 0, retryAfterMs, currentCount}
end

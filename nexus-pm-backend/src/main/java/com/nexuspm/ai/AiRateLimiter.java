package com.nexuspm.ai;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Per-user AI chat rate limit (questions per rolling hour).
 * Uses Redis when available; otherwise in-memory counters.
 */
@Slf4j
@Component
public class AiRateLimiter {

    private final StringRedisTemplate redisTemplate;
    private final Map<String, WindowCounter> local = new ConcurrentHashMap<>();

    public AiRateLimiter(@Autowired(required = false) StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    /**
     * @param limitPerHour 0 or negative = unlimited
     */
    public void checkOrThrow(UUID userId, int limitPerHour) {
        if (limitPerHour <= 0 || userId == null) {
            return;
        }
        String key = "ratelimit:/ai/chat:" + userId;
        long count;
        if (redisTemplate != null) {
            try {
                Long incr = redisTemplate.opsForValue().increment(key);
                if (incr != null && incr == 1L) {
                    redisTemplate.expire(key, Duration.ofHours(1));
                }
                count = incr != null ? incr : 1L;
            } catch (Exception e) {
                log.warn("AI rate limit Redis failed; using memory: {}", e.getMessage());
                count = incrementLocal(key);
            }
        } else {
            count = incrementLocal(key);
        }
        if (count > limitPerHour) {
            throw new com.nexuspm.shared.exception.BusinessException(
                    "AI_RATE_LIMIT",
                    "Assistant rate limit exceeded (" + limitPerHour + " questions/hour). Try again later.",
                    429);
        }
    }

    private long incrementLocal(String key) {
        long now = System.currentTimeMillis();
        WindowCounter counter = local.compute(key, (k, existing) -> {
            if (existing == null || now - existing.windowStartMs > Duration.ofHours(1).toMillis()) {
                return new WindowCounter(now, new AtomicInteger(1));
            }
            existing.count.incrementAndGet();
            return existing;
        });
        return counter.count.get();
    }

    private record WindowCounter(long windowStartMs, AtomicInteger count) {
    }
}

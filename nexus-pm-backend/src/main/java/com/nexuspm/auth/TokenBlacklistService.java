package com.nexuspm.auth;

import com.nexuspm.shared.config.DfnPmProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class TokenBlacklistService {

    private static final String PREFIX = "jwt:blacklist:";

    private final StringRedisTemplate redisTemplate;
    private final boolean redisEnabled;
    private final ConcurrentHashMap<String, Instant> inMemoryBlacklist = new ConcurrentHashMap<>();

    public TokenBlacklistService(
            DfnPmProperties properties,
            @Autowired(required = false) StringRedisTemplate redisTemplate) {
        this.redisEnabled = properties.getSecurity().isRedisEnabled();
        this.redisTemplate = redisTemplate;
        if (redisEnabled && redisTemplate == null) {
            throw new IllegalStateException(
                    "dfnpm.security.redis-enabled is true but no Redis connection is configured");
        }
    }

    public void blacklist(String jti, Instant expiresAt) {
        if (redisEnabled) {
            long ttlSeconds = Math.max(1, expiresAt.getEpochSecond() - Instant.now().getEpochSecond());
            redisTemplate.opsForValue().set(PREFIX + jti, "1", Duration.ofSeconds(ttlSeconds));
            return;
        }
        purgeExpiredInMemoryEntries();
        inMemoryBlacklist.put(jti, expiresAt);
    }

    public void blacklistToken(String token, Instant expiresAt) {
        blacklist(token, expiresAt);
    }

    public boolean isBlacklisted(String token) {
        if (redisEnabled) {
            return Boolean.TRUE.equals(redisTemplate.hasKey(PREFIX + token));
        }
        purgeExpiredInMemoryEntries();
        Instant expiresAt = inMemoryBlacklist.get(token);
        return expiresAt != null && expiresAt.isAfter(Instant.now());
    }

    private void purgeExpiredInMemoryEntries() {
        Instant now = Instant.now();
        for (Iterator<Map.Entry<String, Instant>> iterator = inMemoryBlacklist.entrySet().iterator();
                iterator.hasNext();) {
            Map.Entry<String, Instant> entry = iterator.next();
            if (!entry.getValue().isAfter(now)) {
                iterator.remove();
            }
        }
    }
}

package com.nexuspm.shared.cache;

import com.github.benmanes.caffeine.cache.Caffeine;
import com.nexuspm.shared.config.DfnPmProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.cache.support.NoOpCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;
import java.util.Arrays;

@Configuration
@EnableCaching
@RequiredArgsConstructor
public class CacheConfig {

    private final DfnPmProperties properties;

    @Bean
    public CacheManager cacheManager() {
        DfnPmProperties.Cache cfg = properties.getCache();
        if (!cfg.isEnabled()) {
            return new NoOpCacheManager();
        }
        CaffeineCacheManager manager = new CaffeineCacheManager();
        manager.setCacheNames(Arrays.asList(CacheNames.ALL));
        manager.setCaffeine(Caffeine.newBuilder()
                .maximumSize(cfg.getMaxSize())
                .expireAfterWrite(Duration.ofMinutes(cfg.getTtlMinutes()))
                .recordStats());
        return manager;
    }
}

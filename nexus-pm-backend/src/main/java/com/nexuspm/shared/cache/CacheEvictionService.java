package com.nexuspm.shared.cache;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class CacheEvictionService {

    private final CacheManager cacheManager;

    public void evict(String cacheName) {
        var cache = cacheManager.getCache(cacheName);
        if (cache != null) {
            cache.clear();
            log.debug("Cache cleared: {}", cacheName);
        }
    }

    public void evictAll() {
        for (String name : CacheNames.ALL) {
            evict(name);
        }
        log.info("All application caches cleared");
    }

    /** After reference Excel import / bulk reference changes. */
    public void evictReferenceCatalogs() {
        evict(CacheNames.DEPARTMENTS);
        evict(CacheNames.STREAMS);
        evict(CacheNames.DESIGNATIONS);
        evict(CacheNames.SKILLS);
        evict(CacheNames.WORK_TYPES);
        evict(CacheNames.ROLES);
        evict(CacheNames.PRIORITIES);
        evict(CacheNames.ISSUE_TYPES);
        evict(CacheNames.ISSUE_STATUSES);
        log.info("Reference catalog caches cleared");
    }

    public void evictLookupCatalogs() {
        evict(CacheNames.PRIORITIES);
        evict(CacheNames.ISSUE_TYPES);
        evict(CacheNames.ISSUE_STATUSES);
    }

    public void evictFieldDefinitions() {
        evict(CacheNames.FIELD_DEFS_ALL);
        evict(CacheNames.FIELD_DEFS_ACTIVE);
    }

    public void evictAccessControl() {
        evict(CacheNames.PERMISSIONS);
        evict(CacheNames.ACCESS_ROLES);
        evict(CacheNames.ROLES);
    }
}

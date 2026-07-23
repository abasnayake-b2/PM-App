package com.nexuspm.shared.cache;

import com.nexuspm.admin.AdminService;
import com.nexuspm.admin.ReferenceDataService;
import com.nexuspm.admin.RoleAccessService;
import com.nexuspm.issue.field.IssueFieldDefinitionService;
import com.nexuspm.lookup.LookupService;
import com.nexuspm.shared.config.DfnPmProperties;
import com.nexuspm.user.OrgHierarchyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Loads reference caches on startup and refreshes them daily.
 * Writes still evict immediately via {@code @CacheEvict} / {@link CacheEvictionService}.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CacheWarmupRunner {

    private final DfnPmProperties properties;
    private final CacheEvictionService cacheEvictionService;
    private final LookupService lookupService;
    private final ReferenceDataService referenceDataService;
    private final OrgHierarchyService orgHierarchyService;
    private final RoleAccessService roleAccessService;
    private final IssueFieldDefinitionService issueFieldDefinitionService;
    private final AdminService adminService;

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        if (!properties.getCache().isEnabled() || !properties.getCache().isWarmupOnStartup()) {
            return;
        }
        log.info("Warming application caches…");
        warmup();
        log.info("Application cache warmup complete");
    }

    @Scheduled(cron = "${dfnpm.cache.daily-refresh-cron:0 0 2 * * *}")
    public void dailyRefresh() {
        if (!properties.getCache().isEnabled()) {
            return;
        }
        log.info("Daily cache refresh starting…");
        cacheEvictionService.evictAll();
        warmup();
        log.info("Daily cache refresh complete");
    }

    private void warmup() {
        try {
            lookupService.listPriorities();
            lookupService.listIssueTypes();
            lookupService.listStatuses();
            referenceDataService.listDepartments();
            referenceDataService.listStreams();
            referenceDataService.listDesignations();
            referenceDataService.listSkills();
            referenceDataService.listWorkTypes();
            referenceDataService.listRoles();
            referenceDataService.listIssueTypes();
            referenceDataService.listIssueStatuses();
            referenceDataService.listPriorities();
            orgHierarchyService.listOrgLevels();
            roleAccessService.listPermissions();
            roleAccessService.listRoles();
            issueFieldDefinitionService.listAll();
            issueFieldDefinitionService.listActive();
            adminService.listHolidays();
            adminService.listSettings();
        } catch (Exception e) {
            log.warn("Cache warmup partially failed: {}", e.getMessage());
        }
    }
}

package com.nexuspm.shared.cache;

/** Named caches for infrequently changing reference / lookup data. */
public final class CacheNames {

    public static final String PRIORITIES = "priorities";
    public static final String ISSUE_TYPES = "issue-types";
    public static final String ISSUE_STATUSES = "issue-statuses";
    public static final String DEPARTMENTS = "departments";
    public static final String STREAMS = "streams";
    public static final String DESIGNATIONS = "designations";
    public static final String SKILLS = "skills";
    public static final String WORK_TYPES = "work-types";
    public static final String ROLES = "roles";
    public static final String ORG_LEVELS = "org-levels";
    public static final String PERMISSIONS = "permissions";
    public static final String ACCESS_ROLES = "access-roles";
    public static final String FIELD_DEFS_ALL = "field-defs-all";
    public static final String FIELD_DEFS_ACTIVE = "field-defs-active";
    public static final String HOLIDAYS = "holidays";
    public static final String SETTINGS = "settings";
    public static final String AI_TOOL_CATALOG = "ai-tool-catalog";

    public static final String[] ALL = {
            PRIORITIES,
            ISSUE_TYPES,
            ISSUE_STATUSES,
            DEPARTMENTS,
            STREAMS,
            DESIGNATIONS,
            SKILLS,
            WORK_TYPES,
            ROLES,
            ORG_LEVELS,
            PERMISSIONS,
            ACCESS_ROLES,
            FIELD_DEFS_ALL,
            FIELD_DEFS_ACTIVE,
            HOLIDAYS,
            SETTINGS,
            AI_TOOL_CATALOG
    };

    private CacheNames() {}
}

# Phase 1 schema (canonical)

Apply in order on a clean MySQL:

1. `build.sql` — creates `dfn_pm` database and all tables
2. `seed.sql` — reference data, RBAC, bootstrap admin user
3. Optional: `create-mysql-user.sql` — app user `dfnpm` / `dfnpm`

Existing databases (upgrade in place):

- `Release-9-21-2026.sql` — RD / project tasks (`rd_issue_task`, `project_task`) and allocation links (`project_id`, optional `issue_id`, `project_task_id`, `rd_issue_task_id`). Safe to re-run. Restart the API after applying.

Do **not** run Liquibase for Phase 1 installs (`liquibase.enabled: false`).  
Liquibase changelogs under the backend are legacy / not aligned with this schema.

Bootstrap admin credentials are documented in the `seed.sql` header.

# Phase 1 schema (canonical)

Apply in order on a clean MySQL:

1. `build.sql` — creates `dfn_pm` database and all tables
2. `seed.sql` — reference data, RBAC, bootstrap admin user
3. Optional: `create-mysql-user.sql` — app user `dfnpm` / `dfnpm`

Do **not** run Liquibase for Phase 1 installs (`liquibase.enabled: false`).  
Liquibase changelogs under the backend are legacy / not aligned with this schema.

Bootstrap admin credentials are documented in the `seed.sql` header.

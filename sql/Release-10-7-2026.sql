-- =============================================================================
-- DFN-PlanX — Release 10-7-2026
-- Incremental schema for existing databases.
--
-- employee_manager_assignment — dated engineering-manager history
--
-- Safe to re-run. Do not run on a DB built from the current build.sql
-- (the table is already present).
-- Also applied automatically on API startup (schema migrator).
--
-- Usage (MySQL Workbench or CLI):
--   USE dfn_pm;
--   source Release-10-7-2026.sql
--
-- After this script, restart the API (Hibernate ddl-auto: validate).
-- =============================================================================

CREATE DATABASE IF NOT EXISTS dfn_pm
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE dfn_pm;

SET SQL_SAFE_UPDATES = 0;

SET @tbl := (
    SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'employee_manager_assignment'
);
SET @sql := IF(@tbl = 0,
    'CREATE TABLE employee_manager_assignment (
        id                                   CHAR(36)    NOT NULL PRIMARY KEY,
        employee_id                          CHAR(36)    NOT NULL,
        engineering_manager_management_id    CHAR(36)    NULL,
        from_date                            DATE        NOT NULL,
        to_date                              DATE        NULL,
        source                               VARCHAR(20) NOT NULL DEFAULT ''UI'',
        created_by                           CHAR(36)    NULL,
        updated_by                           CHAR(36)    NULL,
        created_at                           TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at                           TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_ema_employee_from (employee_id, from_date),
        KEY idx_ema_manager_from (engineering_manager_management_id, from_date),
        CONSTRAINT fk_ema_employee FOREIGN KEY (employee_id) REFERENCES employee(id) ON DELETE CASCADE,
        CONSTRAINT fk_ema_manager  FOREIGN KEY (engineering_manager_management_id) REFERENCES team_management(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Current roster: one open assignment per employee (from employee.created_at).
-- Safe to re-run: skips anyone who already has history.
INSERT INTO employee_manager_assignment (
    id, employee_id, engineering_manager_management_id, from_date, to_date, source)
SELECT
    UUID(),
    e.id,
    e.engineering_manager_management_id,
    COALESCE(DATE(e.created_at), CURRENT_DATE),
    NULL,
    'BACKFILL'
FROM employee e
WHERE e.team_management_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM employee_manager_assignment a WHERE a.employee_id = e.id
  );

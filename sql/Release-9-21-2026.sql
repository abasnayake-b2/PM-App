-- =============================================================================
-- DFN-PlanX — Release 9-21-2026
-- Incremental schema for existing databases (combines 027 + 028).
--
-- 027  RD tasks (rd_issue_task) and project-level tasks (project_task)
-- 028  Allocations against a project, project task, RD, and/or RD task
--
-- Safe to re-run. Do not run on a DB built from the current build.sql
-- (those tables/columns are already present).
--
-- Usage (MySQL Workbench or CLI):
--   USE dfn_pm;
--   source Release-9-21-2026.sql
--   -- or: mysql -u root -p dfn_pm < sql/Release-9-21-2026.sql
--
-- After this script, restart the API (Hibernate ddl-auto: validate).
-- =============================================================================

CREATE DATABASE IF NOT EXISTS dfn_pm
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE dfn_pm;

SET SQL_SAFE_UPDATES = 0;

-- -----------------------------------------------------------------------------
-- 027  RD-level and project-level tasks
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS rd_issue_task (
    id              CHAR(36)     NOT NULL PRIMARY KEY,
    issue_id        CHAR(36)     NOT NULL,
    task_number     INT          NOT NULL,
    description     TEXT         NOT NULL,
    module          VARCHAR(120) NULL,
    deleted         TINYINT(1)   NOT NULL DEFAULT 0,
    version         BIGINT       NOT NULL DEFAULT 0,
    created_by      CHAR(36)     NULL,
    updated_by      CHAR(36)     NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_issue_task_number (issue_id, task_number),
    KEY idx_issue_task_issue (issue_id, deleted),
    CONSTRAINT fk_issue_task_issue FOREIGN KEY (issue_id) REFERENCES rd_issue(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_task (
    id              CHAR(36)     NOT NULL PRIMARY KEY,
    project_id      CHAR(36)     NOT NULL,
    task_number     INT          NOT NULL,
    description     TEXT         NOT NULL,
    module          VARCHAR(120) NULL,
    deleted         TINYINT(1)   NOT NULL DEFAULT 0,
    version         BIGINT       NOT NULL DEFAULT 0,
    created_by      CHAR(36)     NULL,
    updated_by      CHAR(36)     NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_project_task_number (project_id, task_number),
    KEY idx_project_task_project (project_id, deleted),
    CONSTRAINT fk_project_task_project FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 028  Allocation targets: project, project task, RD, RD task
-- -----------------------------------------------------------------------------

SET @col := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'allocation' AND column_name = 'project_id'
);
SET @sql := IF(@col = 0,
    'ALTER TABLE allocation ADD COLUMN project_id CHAR(36) NULL AFTER employee_id',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE allocation a
INNER JOIN rd_issue i ON i.id = a.issue_id
SET a.project_id = i.project_id
WHERE a.id IS NOT NULL
  AND a.project_id IS NULL;

-- project_id stays nullable so non-project allocations can omit a project.

SET @fk := (
    SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'allocation' AND constraint_name = 'fk_alloc_project'
);
SET @sql := IF(@fk = 0,
    'ALTER TABLE allocation ADD CONSTRAINT fk_alloc_project FOREIGN KEY (project_id) REFERENCES project(id)',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @nullable := (
    SELECT IS_NULLABLE FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'allocation' AND column_name = 'issue_id'
);
SET @sql := IF(@nullable = 'NO',
    'ALTER TABLE allocation MODIFY issue_id CHAR(36) NULL',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'allocation' AND column_name = 'project_task_id'
);
SET @sql := IF(@col = 0,
    'ALTER TABLE allocation ADD COLUMN project_task_id CHAR(36) NULL AFTER issue_id',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (
    SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'allocation' AND constraint_name = 'fk_alloc_project_task'
);
SET @sql := IF(@fk = 0,
    'ALTER TABLE allocation ADD CONSTRAINT fk_alloc_project_task FOREIGN KEY (project_task_id) REFERENCES project_task(id)',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'allocation' AND column_name = 'rd_issue_task_id'
);
SET @sql := IF(@col = 0,
    'ALTER TABLE allocation ADD COLUMN rd_issue_task_id CHAR(36) NULL AFTER project_task_id',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (
    SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'allocation' AND constraint_name = 'fk_alloc_rd_issue_task'
);
SET @sql := IF(@fk = 0,
    'ALTER TABLE allocation ADD CONSTRAINT fk_alloc_rd_issue_task FOREIGN KEY (rd_issue_task_id) REFERENCES rd_issue_task(id)',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET SQL_SAFE_UPDATES = 1;

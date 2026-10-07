-- =============================================================================
-- DFN-PlanX — Release 9-28-2026
-- Incremental schema for existing databases (combines 029 + 030).
--
-- 029  team_management.department_id
-- 030  task_type, task_category, non_project_task, allocation FKs,
--      nullable allocation.project_id
--
-- Safe to re-run. Do not run on a DB built from the current build.sql
-- (those tables/columns are already present).
-- Also applied automatically on API startup (schema migrators).
--
-- Usage (MySQL Workbench or CLI):
--   USE dfn_pm;
--   source Release-9-28-2026.sql
--   -- or: mysql -u root -p dfn_pm < sql/Release-9-28-2026.sql
--
-- After this script, restart the API (Hibernate ddl-auto: validate).
-- =============================================================================

CREATE DATABASE IF NOT EXISTS dfn_pm
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE dfn_pm;

SET SQL_SAFE_UPDATES = 0;

-- -----------------------------------------------------------------------------
-- 029  Management roster department
-- -----------------------------------------------------------------------------

SET @col := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'team_management' AND column_name = 'department_id'
);
SET @sql := IF(@col = 0,
    'ALTER TABLE team_management ADD COLUMN department_id CHAR(36) NULL AFTER employment_type',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (
    SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'team_management' AND constraint_name = 'fk_tm_department'
);
SET @sql := IF(@fk = 0,
    'ALTER TABLE team_management ADD CONSTRAINT fk_tm_department FOREIGN KEY (department_id) REFERENCES department(id)',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------------------------------
-- 030  Task types, task categories, non-project allocations
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS task_type (
    id          CHAR(36)     NOT NULL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL UNIQUE,
    description VARCHAR(500) NULL,
    sort_order  INT          NOT NULL DEFAULT 0,
    created_by  CHAR(36)     NULL,
    updated_by  CHAR(36)     NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO task_type (id, name, description, sort_order) VALUES
('a1000001-0000-0000-0000-000000000001', 'Roadmap / new features', NULL, 1),
('a1000001-0000-0000-0000-000000000002', 'Maintenance', NULL, 2),
('a1000001-0000-0000-0000-000000000006', 'Upgrades', NULL, 3),
('a1000001-0000-0000-0000-000000000007', 'Bugs', NULL, 4),
('a1000001-0000-0000-0000-000000000003', 'Tech debt', NULL, 5),
('a1000001-0000-0000-0000-000000000008', 'Platform improvement', NULL, 6),
('a1000001-0000-0000-0000-000000000004', 'Support', NULL, 7),
('a1000001-0000-0000-0000-000000000005', 'Other', NULL, 8);

UPDATE task_type SET name = 'Maintenance', sort_order = 2
WHERE name = 'Maintenance, upgrades, bugs'
   OR id = 'a1000001-0000-0000-0000-000000000002';

UPDATE task_type SET name = 'Tech debt', sort_order = 5
WHERE name = 'Tech debt / platform improvement'
   OR id = 'a1000001-0000-0000-0000-000000000003';

UPDATE task_type SET name = 'Support', sort_order = 7
WHERE name = 'Support, incidents, on-call'
   OR id = 'a1000001-0000-0000-0000-000000000004';

UPDATE task_type SET sort_order = 1 WHERE id = 'a1000001-0000-0000-0000-000000000001';
UPDATE task_type SET sort_order = 3 WHERE id = 'a1000001-0000-0000-0000-000000000006';
UPDATE task_type SET sort_order = 4 WHERE id = 'a1000001-0000-0000-0000-000000000007';
UPDATE task_type SET sort_order = 6 WHERE id = 'a1000001-0000-0000-0000-000000000008';
UPDATE task_type SET sort_order = 8 WHERE id = 'a1000001-0000-0000-0000-000000000005';

CREATE TABLE IF NOT EXISTS task_category (
    id          CHAR(36)     NOT NULL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL UNIQUE,
    description VARCHAR(500) NULL,
    sort_order  INT          NOT NULL DEFAULT 0,
    created_by  CHAR(36)     NULL,
    updated_by  CHAR(36)     NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO task_category (id, name, description, sort_order) VALUES
('b1000001-0000-0000-0000-000000000001', 'Project related', NULL, 1),
('b1000001-0000-0000-0000-000000000002', 'Non-Project Related', NULL, 2);

SET @col := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'allocation' AND column_name = 'task_type_id'
);
SET @sql := IF(@col = 0,
    'ALTER TABLE allocation ADD COLUMN task_type_id CHAR(36) NULL AFTER rd_issue_task_id',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (
    SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'allocation' AND constraint_name = 'fk_alloc_task_type'
);
SET @sql := IF(@fk = 0,
    'ALTER TABLE allocation ADD CONSTRAINT fk_alloc_task_type FOREIGN KEY (task_type_id) REFERENCES task_type(id)',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'allocation' AND column_name = 'task_category_id'
);
SET @sql := IF(@col = 0,
    'ALTER TABLE allocation ADD COLUMN task_category_id CHAR(36) NULL AFTER task_type_id',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (
    SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'allocation' AND constraint_name = 'fk_alloc_task_category'
);
SET @sql := IF(@fk = 0,
    'ALTER TABLE allocation ADD CONSTRAINT fk_alloc_task_category FOREIGN KEY (task_category_id) REFERENCES task_category(id)',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS non_project_task (
    id              CHAR(36)     NOT NULL PRIMARY KEY,
    description     TEXT         NOT NULL,
    module          VARCHAR(120) NULL,
    deleted         TINYINT(1)   NOT NULL DEFAULT 0,
    version         BIGINT       NOT NULL DEFAULT 0,
    created_by      CHAR(36)     NULL,
    updated_by      CHAR(36)     NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @sql := (
    SELECT IF(
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = 'allocation' AND column_name = 'project_id') > 0,
        'ALTER TABLE allocation MODIFY project_id CHAR(36) NULL',
        'SELECT 1')
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'allocation' AND column_name = 'non_project_task_id'
);
SET @sql := IF(@col = 0,
    'ALTER TABLE allocation ADD COLUMN non_project_task_id CHAR(36) NULL AFTER task_category_id',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (
    SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'allocation' AND constraint_name = 'fk_alloc_non_project_task'
);
SET @sql := IF(@fk = 0,
    'ALTER TABLE allocation ADD CONSTRAINT fk_alloc_non_project_task FOREIGN KEY (non_project_task_id) REFERENCES non_project_task(id)',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET SQL_SAFE_UPDATES = 1;

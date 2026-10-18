-- =============================================================================
-- DFN-PlanX — Release 10-15-2026
-- Incremental schema for existing databases.
--
-- project_type lookup on project; work_category master data assigned to EMs
-- and also mapped directly on project (functional unit)
--
-- Safe to re-run. Do not run on a DB built from the current build.sql
-- (the tables/columns are already present).
-- Also applied automatically on API startup (schema migrator).
--
-- Usage (MySQL Workbench or CLI):
--   USE dfn_pm;
--   source Release-10-15-2026.sql
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
    WHERE table_schema = DATABASE() AND table_name = 'project_type'
);
SET @sql := IF(@tbl = 0,
    'CREATE TABLE project_type (
        id          CHAR(36)     NOT NULL PRIMARY KEY,
        name        VARCHAR(150) NOT NULL UNIQUE,
        description VARCHAR(500) NULL,
        sort_order  INT          NOT NULL DEFAULT 0,
        created_by  CHAR(36)     NULL,
        updated_by  CHAR(36)     NULL,
        created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @tbl := (
    SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'work_category'
);
SET @sql := IF(@tbl = 0,
    'CREATE TABLE work_category (
        id          CHAR(36)     NOT NULL PRIMARY KEY,
        name        VARCHAR(150) NOT NULL UNIQUE,
        description VARCHAR(500) NULL,
        sort_order  INT          NOT NULL DEFAULT 0,
        created_by  CHAR(36)     NULL,
        updated_by  CHAR(36)     NULL,
        created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO project_type (id, name, sort_order) VALUES
('d1000001-0000-0000-0000-000000000001', 'NTP', 1),
('d1000001-0000-0000-0000-000000000002', 'GBL', 2),
('d1000001-0000-0000-0000-000000000003', 'Client Project', 3);

INSERT IGNORE INTO work_category (id, name, sort_order) VALUES
('e1000001-0000-0000-0000-000000000001', 'Global BMS L3 Support', 1),
('e1000001-0000-0000-0000-000000000002', 'Global BMS KTLO', 2),
('e1000001-0000-0000-0000-000000000003', 'BAU - ALL KSA GBL', 3),
('e1000001-0000-0000-0000-000000000004', 'Dedicated Allocation', 4),
('e1000001-0000-0000-0000-000000000005', 'KSA NTP BAU Team 01', 5),
('e1000001-0000-0000-0000-000000000006', 'KSA NTP BAU Team 02', 6),
('e1000001-0000-0000-0000-000000000007', 'BMS Product Development NTP 2.0', 7),
('e1000001-0000-0000-0000-000000000008', 'BMS - None Functional Development', 8),
('e1000001-0000-0000-0000-000000000009', 'DT/PRO - BMS', 9),
('e1000001-0000-0000-0000-000000000010', 'DFNOne + PRO Retails', 10),
('e1000001-0000-0000-0000-000000000011', 'MBE Products', 11),
('e1000001-0000-0000-0000-000000000012', 'CMS Product', 12),
('e1000001-0000-0000-0000-000000000013', 'UA Product', 13),
('e1000001-0000-0000-0000-000000000014', 'International - BAU RDs only', 14),
('e1000001-0000-0000-0000-000000000015', 'ASIA and Africa - All GBL and NTP clients', 15),
('e1000001-0000-0000-0000-000000000016', 'GCC GBL', 16),
('e1000001-0000-0000-0000-000000000017', 'GCC NTP', 17);

SET @col := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'project' AND column_name = 'project_type_id'
);
SET @sql := IF(@col = 0,
    'ALTER TABLE project ADD COLUMN project_type_id CHAR(36) NULL AFTER product',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'project' AND column_name = 'work_category_id'
);
SET @sql := IF(@col = 0,
    'ALTER TABLE project ADD COLUMN work_category_id CHAR(36) NULL AFTER project_type_id',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (
    SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'project' AND constraint_name = 'fk_project_type'
);
SET @sql := IF(@fk = 0,
    'ALTER TABLE project ADD CONSTRAINT fk_project_type FOREIGN KEY (project_type_id) REFERENCES project_type(id)',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (
    SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'project' AND constraint_name = 'fk_project_work_category'
);
SET @sql := IF(@fk = 0,
    'ALTER TABLE project ADD CONSTRAINT fk_project_work_category FOREIGN KEY (work_category_id) REFERENCES work_category(id)',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE project p
JOIN project_type t ON UPPER(TRIM(p.product)) = UPPER(t.name)
SET p.project_type_id = t.id
WHERE p.project_type_id IS NULL
  AND t.name IN ('NTP', 'GBL');

-- Work category is master data assigned to engineering managers, not to projects.
SET @tbl := (
    SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'work_category_manager'
);
SET @sql := IF(@tbl = 0,
    'CREATE TABLE work_category_manager (
        id                                   CHAR(36) NOT NULL PRIMARY KEY,
        work_category_id                     CHAR(36) NOT NULL,
        engineering_manager_management_id    CHAR(36) NOT NULL,
        UNIQUE KEY uk_work_category_manager (work_category_id, engineering_manager_management_id),
        CONSTRAINT fk_wcm_category FOREIGN KEY (work_category_id) REFERENCES work_category(id) ON DELETE CASCADE,
        CONSTRAINT fk_wcm_manager  FOREIGN KEY (engineering_manager_management_id) REFERENCES team_management(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'project' AND column_name = 'work_category_id'
);
SET @sql := IF(@col > 0,
    'INSERT IGNORE INTO work_category_manager (id, work_category_id, engineering_manager_management_id)
     SELECT UUID(), p.work_category_id, p.engineering_manager_management_id
     FROM project p
     WHERE p.work_category_id IS NOT NULL
       AND p.engineering_manager_management_id IS NOT NULL',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'allocation' AND column_name = 'work_category_id'
);
SET @sql := IF(@col = 0,
    'ALTER TABLE allocation ADD COLUMN work_category_id CHAR(36) NULL AFTER task_category_id',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (
    SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'allocation' AND constraint_name = 'fk_alloc_work_category'
);
SET @sql := IF(@fk = 0,
    'ALTER TABLE allocation ADD CONSTRAINT fk_alloc_work_category FOREIGN KEY (work_category_id) REFERENCES work_category(id)',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO task_category (id, name, description, sort_order) VALUES
('b1000001-0000-0000-0000-000000000003', 'Other', NULL, 3);

-- Map projects to functional unit independently of EM assignment
SET @col := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'project' AND column_name = 'work_category_id'
);
SET @sql := IF(@col = 0,
    'ALTER TABLE project ADD COLUMN work_category_id CHAR(36) NULL AFTER project_type_id',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (
    SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'project' AND constraint_name = 'fk_project_work_category'
);
SET @sql := IF(@fk = 0,
    'ALTER TABLE project ADD CONSTRAINT fk_project_work_category FOREIGN KEY (work_category_id) REFERENCES work_category(id)',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE allocation a
JOIN project p ON a.project_id = p.id
SET a.work_category_id = p.work_category_id
WHERE a.work_category_id IS NULL
  AND p.work_category_id IS NOT NULL;

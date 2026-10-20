-- =============================================================================
-- DFN-PlanX — Release 10-20-2026
-- Functional unit categories (BMS, FINCON, IFSAH) and the optional link from
-- each functional unit (work_category).
--
-- Safe to re-run. Also applied automatically on API startup.
--
-- Usage:
--   USE dfn_pm;
--   source Release-10-20-2026.sql
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
    WHERE table_schema = DATABASE() AND table_name = 'functional_unit_category'
);
SET @sql := IF(@tbl = 0,
    'CREATE TABLE functional_unit_category (
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

INSERT IGNORE INTO functional_unit_category (id, name, sort_order) VALUES
('f1000001-0000-0000-0000-000000000001', 'BMS', 1),
('f1000001-0000-0000-0000-000000000002', 'FINCON', 2),
('f1000001-0000-0000-0000-000000000003', 'IFSAH', 3);

SET @col := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'work_category'
      AND column_name = 'functional_unit_category_id'
);
SET @sql := IF(@col = 0,
    'ALTER TABLE work_category ADD COLUMN functional_unit_category_id CHAR(36) NULL AFTER sort_order',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (
    SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE()
      AND table_name = 'work_category'
      AND constraint_name = 'fk_work_category_fu_category'
);
SET @sql := IF(@fk = 0,
    'ALTER TABLE work_category ADD CONSTRAINT fk_work_category_fu_category FOREIGN KEY (functional_unit_category_id) REFERENCES functional_unit_category(id)',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

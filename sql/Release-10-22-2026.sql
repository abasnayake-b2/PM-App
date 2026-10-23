-- =============================================================================
-- DFN-PlanX — Release 10-22-2026
-- Directors and VP Engineering assigned to a functional unit (work_category).
--
-- Safe to re-run. Also applied automatically on API startup.
--
-- Usage:
--   USE dfn_pm;
--   source Release-10-22-2026.sql
--
-- After this script, restart the API (Hibernate ddl-auto: validate).
-- =============================================================================

CREATE DATABASE IF NOT EXISTS dfn_pm
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE dfn_pm;

CREATE TABLE IF NOT EXISTS work_category_director (
    id                      CHAR(36) NOT NULL PRIMARY KEY,
    work_category_id        CHAR(36) NOT NULL,
    director_management_id  CHAR(36) NOT NULL,
    UNIQUE KEY uk_work_category_director (work_category_id, director_management_id),
    CONSTRAINT fk_wcd_category FOREIGN KEY (work_category_id) REFERENCES work_category(id) ON DELETE CASCADE,
    CONSTRAINT fk_wcd_director FOREIGN KEY (director_management_id) REFERENCES team_management(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

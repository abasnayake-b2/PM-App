-- =============================================================================
-- DFN-PlanX — MySQL application user (matches application.yml defaults)
--
-- Usage:
--   mysql -u root -p < create-mysql-user.sql
-- =============================================================================

CREATE DATABASE IF NOT EXISTS dfn_pm
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'dfnpm'@'localhost' IDENTIFIED BY 'dfnpm';
GRANT ALL PRIVILEGES ON dfn_pm.* TO 'dfnpm'@'localhost';
FLUSH PRIVILEGES;

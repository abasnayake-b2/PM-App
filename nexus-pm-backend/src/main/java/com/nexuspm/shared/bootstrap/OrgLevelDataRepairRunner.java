package com.nexuspm.shared.bootstrap;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Repairs org_level rows from an older seed that used non-hex UUID prefixes (e.g. o1000001-...).
 * Hibernate cannot map those values to java.util.UUID, which breaks login and all API calls.
 */
@Component
@Order(0)
@RequiredArgsConstructor
@Slf4j
public class OrgLevelDataRepairRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        if (!tableExists("org_level") || !columnExists("role", "org_level_id")) {
            return;
        }

        Integer invalid = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM role
                WHERE org_level_id IS NOT NULL
                  AND org_level_id NOT REGEXP '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                """,
                Integer.class);

        if (invalid == null || invalid == 0) {
            return;
        }

        log.warn("Found {} role(s) with invalid org_level_id — repairing org hierarchy data", invalid);
        jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 0");
        try {
            jdbcTemplate.execute("DELETE FROM org_level");
            jdbcTemplate.update("""
                INSERT INTO org_level (id, code, name, level_order, reports_to_org_level_id) VALUES
                ('0c000001-0000-0000-0000-000000000001', 'CXO',      'CXO',      1, NULL),
                ('0c000001-0000-0000-0000-000000000002', 'VP',       'VP',       2, '0c000001-0000-0000-0000-000000000001'),
                ('0c000001-0000-0000-0000-000000000003', 'MANAGER',  'Manager / Senior Manager',  3, '0c000001-0000-0000-0000-000000000002'),
                ('0c000001-0000-0000-0000-000000000004', 'EMPLOYEE', 'Employee', 4, '0c000001-0000-0000-0000-000000000003')
                """);

            jdbcTemplate.update(
                    "UPDATE role SET org_level_id = '0c000001-0000-0000-0000-000000000001' WHERE code IN ('CXO', 'CTO', 'CEO')");
            jdbcTemplate.update(
                    "UPDATE role SET org_level_id = '0c000001-0000-0000-0000-000000000002' WHERE code IN ('VP', 'VP_ENG')");
            jdbcTemplate.update(
                    "UPDATE role SET name = 'Manager / Senior Manager', org_level_id = '0c000001-0000-0000-0000-000000000003' WHERE code IN ('MANAGER', 'SEM', 'SR_SEM')");
            jdbcTemplate.update(
                    "UPDATE role SET org_level_id = '0c000001-0000-0000-0000-000000000004' WHERE code IN ('EMPLOYEE', 'SW_ENGINEER', 'TECH_LEAD')");

            jdbcTemplate.update("""
                INSERT IGNORE INTO role (id, name, code, org_level_id) VALUES
                ('11111111-1111-1111-1111-111111111101', 'Super Admin', 'SUPER_ADMIN', NULL),
                ('11111111-1111-1111-1111-111111111102', 'Admin',       'ADMIN',       NULL),
                ('11111111-1111-1111-1111-111111111103', 'CXO',         'CXO',         '0c000001-0000-0000-0000-000000000001'),
                ('11111111-1111-1111-1111-111111111104', 'VP',          'VP',          '0c000001-0000-0000-0000-000000000002'),
                ('11111111-1111-1111-1111-111111111105', 'Manager / Senior Manager', 'MANAGER', '0c000001-0000-0000-0000-000000000003'),
                ('11111111-1111-1111-1111-111111111106', 'Employee',    'EMPLOYEE',    '0c000001-0000-0000-0000-000000000004')
                """);

            log.info("Org hierarchy data repaired — restart is not required");
        } finally {
            jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 1");
        }
    }

    private boolean tableExists(String table) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM information_schema.tables
                WHERE table_schema = DATABASE() AND table_name = ?
                """,
                Integer.class,
                table);
        return count != null && count > 0;
    }

    private boolean columnExists(String table, String column) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
                """,
                Integer.class,
                table,
                column);
        return count != null && count > 0;
    }
}

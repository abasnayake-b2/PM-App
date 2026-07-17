package com.nexuspm.shared.bootstrap;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Keeps org_level aligned to the product reporting line:
 * CXO → VP → Manager (Senior Manager or Manager) → Employee.
 */
@Component
@Order(1)
@RequiredArgsConstructor
@Slf4j
public class OrgHierarchyAlignRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        if (!tableExists("org_level") || !columnExists("role", "org_level_id")) {
            return;
        }

        Integer matched = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM org_level
                WHERE (code = 'CXO' AND level_order = 1 AND reports_to_org_level_id IS NULL)
                   OR (code = 'VP' AND level_order = 2)
                   OR (code = 'MANAGER' AND level_order = 3)
                   OR (code = 'EMPLOYEE' AND level_order = 4)
                """,
                Integer.class);

        if (matched != null && matched >= 4) {
            alignRoleMappings();
            return;
        }

        log.info("Aligning org hierarchy to CXO → VP → Manager → Employee");
        jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 0");
        try {
            jdbcTemplate.update("UPDATE role SET org_level_id = NULL WHERE org_level_id IS NOT NULL");
            jdbcTemplate.execute("DELETE FROM org_level");
            jdbcTemplate.update("""
                INSERT INTO org_level (id, code, name, level_order, reports_to_org_level_id) VALUES
                ('0c000001-0000-0000-0000-000000000001', 'CXO',      'CXO',      1, NULL),
                ('0c000001-0000-0000-0000-000000000002', 'VP',       'VP',       2, '0c000001-0000-0000-0000-000000000001'),
                ('0c000001-0000-0000-0000-000000000003', 'MANAGER',  'Manager / Senior Manager',  3, '0c000001-0000-0000-0000-000000000002'),
                ('0c000001-0000-0000-0000-000000000004', 'EMPLOYEE', 'Employee', 4, '0c000001-0000-0000-0000-000000000003')
                """);
            alignRoleMappings();
            log.info("Org hierarchy aligned");
        } finally {
            jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 1");
        }
    }

    private void alignRoleMappings() {
        jdbcTemplate.update(
                "UPDATE role SET org_level_id = '0c000001-0000-0000-0000-000000000001' WHERE code IN ('CXO', 'CTO', 'CEO')");
        jdbcTemplate.update(
                "UPDATE role SET org_level_id = '0c000001-0000-0000-0000-000000000002' WHERE code IN ('VP', 'VP_ENG')");
        jdbcTemplate.update(
                "UPDATE role SET name = 'Manager / Senior Manager', org_level_id = '0c000001-0000-0000-0000-000000000003' WHERE code IN ('MANAGER', 'SEM', 'SR_SEM')");
        jdbcTemplate.update(
                "UPDATE role SET org_level_id = '0c000001-0000-0000-0000-000000000004' WHERE code IN ('EMPLOYEE', 'SW_ENGINEER', 'TECH_LEAD')");
        jdbcTemplate.update("UPDATE role SET org_level_id = NULL WHERE code IN ('SUPER_ADMIN', 'ADMIN')");
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

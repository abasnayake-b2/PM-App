package com.nexuspm.shared.bootstrap;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Ensures employee.org_wide_visibility exists (Manager/VP own-team vs org-wide toggle).
 * Existing VP accounts default to org-wide once when the column is introduced.
 */
@Component
@Order(2)
@RequiredArgsConstructor
@Slf4j
public class OrgWideVisibilityColumnRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = 'employee'
                  AND column_name = 'org_wide_visibility'
                """,
                Integer.class);
        boolean created = false;
        if (count == null || count == 0) {
            log.info("Adding employee.org_wide_visibility column");
            jdbcTemplate.execute(
                    "ALTER TABLE employee ADD COLUMN org_wide_visibility TINYINT(1) NOT NULL DEFAULT 0 AFTER available_from");
            created = true;
        }
        if (created) {
            enableOrgWideForVps();
            return;
        }
        // Existing DBs where the column was added with DEFAULT 0 — restore VP org-wide default
        // once, until at least one VP is explicitly marked org-wide.
        Integer vpTotal = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM employee e
                INNER JOIN employee_role er ON er.employee_id = e.id
                INNER JOIN role r ON r.id = er.role_id
                WHERE r.code IN ('VP', 'VP_ENG')
                """,
                Integer.class);
        Integer vpWide = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM employee e
                INNER JOIN employee_role er ON er.employee_id = e.id
                INNER JOIN role r ON r.id = er.role_id
                WHERE r.code IN ('VP', 'VP_ENG') AND e.org_wide_visibility = 1
                """,
                Integer.class);
        if (vpTotal != null && vpTotal > 0 && (vpWide == null || vpWide == 0)) {
            log.info("Enabling org-wide visibility for existing VP accounts (legacy default)");
            enableOrgWideForVps();
        }
    }

    private void enableOrgWideForVps() {
        jdbcTemplate.update("""
                UPDATE employee e
                INNER JOIN employee_role er ON er.employee_id = e.id
                INNER JOIN role r ON r.id = er.role_id
                SET e.org_wide_visibility = 1
                WHERE r.code IN ('VP', 'VP_ENG')
                """);
    }
}

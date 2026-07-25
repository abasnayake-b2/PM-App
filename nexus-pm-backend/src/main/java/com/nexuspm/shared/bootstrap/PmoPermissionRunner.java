package com.nexuspm.shared.bootstrap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Ensures PMO_VIEW / CREATE / UPDATE / DELETE exist and are granted to
 * Super Admin, Admin, and CXO/VP/Manager (view + update). Safe to re-run.
 */
@Component
@Order(41)
public class PmoPermissionRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(PmoPermissionRunner.class);

    private static final String[][] PERMISSIONS = {
            {"b1000001-0000-0000-0000-000000000042", "PMO_VIEW", "VIEW", "PMO pages — View"},
            {"b1000001-0000-0000-0000-000000000043", "PMO_CREATE", "CREATE", "PMO pages — Create"},
            {"b1000001-0000-0000-0000-000000000044", "PMO_UPDATE", "UPDATE", "PMO pages — Update"},
            {"b1000001-0000-0000-0000-000000000045", "PMO_DELETE", "DELETE", "PMO pages — Delete"},
    };

    private final JdbcTemplate jdbc;

    public PmoPermissionRunner(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        for (String[] row : PERMISSIONS) {
            ensurePermission(row[0], row[1], row[2], row[3]);
        }

        int superLinked = jdbc.update(
                """
                INSERT IGNORE INTO role_permission (role_id, permission_id)
                SELECT '11111111-1111-1111-1111-111111111101', id
                FROM permission WHERE module = 'PMO'
                """);

        int adminLinked = jdbc.update(
                """
                INSERT IGNORE INTO role_permission (role_id, permission_id)
                SELECT '11111111-1111-1111-1111-111111111102', id
                FROM permission WHERE module = 'PMO' AND action <> 'DELETE'
                """);

        int leadersLinked = jdbc.update(
                """
                INSERT IGNORE INTO role_permission (role_id, permission_id)
                SELECT r.id, p.id
                FROM role r
                CROSS JOIN permission p
                WHERE r.code IN ('CXO', 'VP', 'MANAGER')
                  AND p.code IN ('PMO_VIEW', 'PMO_UPDATE')
                """);

        if (superLinked + adminLinked + leadersLinked > 0) {
            log.info(
                    "Granted PMO permissions (super={}, admin={}, leaders={})",
                    superLinked,
                    adminLinked,
                    leadersLinked);
        }
    }

    private void ensurePermission(String id, String code, String action, String name) {
        Integer exists = jdbc.queryForObject(
                "SELECT COUNT(*) FROM permission WHERE code = ?",
                Integer.class,
                code);
        if (exists == null || exists == 0) {
            jdbc.update(
                    """
                    INSERT INTO permission (id, name, code, module, action)
                    VALUES (?, ?, ?, 'PMO', ?)
                    """,
                    id,
                    name,
                    code,
                    action);
            log.info("Inserted permission {}", code);
        }
    }
}

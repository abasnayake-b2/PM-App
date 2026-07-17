package com.nexuspm.shared.bootstrap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Ensures ORG_STRUCTURE_VIEW exists and is granted to Admin + CXO/VP/Manager
 * (and Super Admin via all-permissions). Safe to re-run.
 */
@Component
@Order(40)
public class OrgStructurePermissionRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(OrgStructurePermissionRunner.class);

    private static final String PERMISSION_ID = "b1000001-0000-0000-0000-000000000041";
    private static final String PERMISSION_CODE = "ORG_STRUCTURE_VIEW";

    private final JdbcTemplate jdbc;

    public OrgStructurePermissionRunner(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        Integer exists = jdbc.queryForObject(
                "SELECT COUNT(*) FROM permission WHERE code = ?",
                Integer.class,
                PERMISSION_CODE);
        if (exists == null || exists == 0) {
            jdbc.update(
                    """
                    INSERT INTO permission (id, name, code, module, action)
                    VALUES (?, 'Org structure — View', ?, 'ORG_STRUCTURE', 'VIEW')
                    """,
                    PERMISSION_ID,
                    PERMISSION_CODE);
            log.info("Inserted permission {}", PERMISSION_CODE);
        }

        // Super Admin — all permissions (idempotent)
        int superLinked = jdbc.update(
                """
                INSERT IGNORE INTO role_permission (role_id, permission_id)
                SELECT '11111111-1111-1111-1111-111111111101', id
                FROM permission WHERE code = ?
                """,
                PERMISSION_CODE);

        // Admin — non-admin modules already include ORG_STRUCTURE; grant explicitly
        int adminLinked = jdbc.update(
                """
                INSERT IGNORE INTO role_permission (role_id, permission_id)
                SELECT '11111111-1111-1111-1111-111111111102', id
                FROM permission WHERE code = ?
                """,
                PERMISSION_CODE);

        // CXO / VP / Manager
        int leadersLinked = jdbc.update(
                """
                INSERT IGNORE INTO role_permission (role_id, permission_id)
                SELECT r.id, p.id
                FROM role r
                CROSS JOIN permission p
                WHERE r.code IN ('CXO', 'VP', 'MANAGER')
                  AND p.code = ?
                """,
                PERMISSION_CODE);

        if (superLinked + adminLinked + leadersLinked > 0) {
            log.info(
                    "Granted {} to roles (super={}, admin={}, leaders={})",
                    PERMISSION_CODE,
                    superLinked,
                    adminLinked,
                    leadersLinked);
        }
    }
}

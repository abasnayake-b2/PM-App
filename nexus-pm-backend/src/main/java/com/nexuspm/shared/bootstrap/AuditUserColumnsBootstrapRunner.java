package com.nexuspm.shared.bootstrap;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Ensures created_by / updated_by exist on auditable tables when Liquibase is disabled.
 */
@Component
@Order(27)
@RequiredArgsConstructor
@Slf4j
public class AuditUserColumnsBootstrapRunner implements ApplicationRunner {

    private static final String[] TABLES = {
            "region",
            "country",
            "client",
            "department",
            "stream",
            "work_type",
            "skill",
            "designation",
            "org_level",
            "role",
            "permission",
            "employee",
            "team_management",
            "team_import_batch",
            "project",
            "budget",
            "release",
            "rd_issue",
            "allocation",
            "time_log"
    };

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        for (String table : TABLES) {
            ensureAuditColumns(table);
        }
    }

    private void ensureAuditColumns(String table) {
        Integer tableCount = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM information_schema.tables
                WHERE table_schema = DATABASE() AND table_name = ?
                """,
                Integer.class,
                table);
        if (tableCount == null || tableCount == 0) {
            return;
        }
        ensureColumn(table, "created_by");
        ensureColumn(table, "updated_by");
    }

    private void ensureColumn(String table, String column) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = ?
                  AND column_name = ?
                """,
                Integer.class,
                table,
                column);
        if (count != null && count > 0) {
            return;
        }
        log.info("Adding {}.{} column", table, column);
        jdbcTemplate.execute("ALTER TABLE `" + table + "` ADD COLUMN `" + column + "` CHAR(36) NULL");
    }
}

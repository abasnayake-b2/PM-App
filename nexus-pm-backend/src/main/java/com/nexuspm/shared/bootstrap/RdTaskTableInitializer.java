package com.nexuspm.shared.bootstrap;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

/**
 * Ensures RD / project task tables exist before Hibernate validate (Liquibase is disabled).
 */
@Component("rdTaskTableInitializer")
@RequiredArgsConstructor
@Slf4j
public class RdTaskTableInitializer {

    private static final String RD_ISSUE_TASK = """
            CREATE TABLE IF NOT EXISTS rd_issue_task (
                id              CHAR(36)     NOT NULL PRIMARY KEY,
                issue_id        CHAR(36)     NOT NULL,
                task_number     INT          NOT NULL,
                description     TEXT         NOT NULL,
                module          VARCHAR(120) NULL,
                deleted         TINYINT(1)   NOT NULL DEFAULT 0,
                version         BIGINT       NOT NULL DEFAULT 0,
                created_by      CHAR(36)     NULL,
                updated_by      CHAR(36)     NULL,
                created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uk_issue_task_number (issue_id, task_number),
                KEY idx_issue_task_issue (issue_id, deleted),
                CONSTRAINT fk_issue_task_issue FOREIGN KEY (issue_id) REFERENCES rd_issue(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """;

    private static final String PROJECT_TASK = """
            CREATE TABLE IF NOT EXISTS project_task (
                id              CHAR(36)     NOT NULL PRIMARY KEY,
                project_id      CHAR(36)     NOT NULL,
                task_number     INT          NOT NULL,
                description     TEXT         NOT NULL,
                module          VARCHAR(120) NULL,
                deleted         TINYINT(1)   NOT NULL DEFAULT 0,
                version         BIGINT       NOT NULL DEFAULT 0,
                created_by      CHAR(36)     NULL,
                updated_by      CHAR(36)     NULL,
                created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uk_project_task_number (project_id, task_number),
                KEY idx_project_task_project (project_id, deleted),
                CONSTRAINT fk_project_task_project FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """;

    private final DataSource dataSource;

    @jakarta.annotation.PostConstruct
    public void createTablesIfMissing() {
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        jdbc.execute(RD_ISSUE_TASK);
        jdbc.execute(PROJECT_TASK);
        migrateAllocationTaskColumns(jdbc);
        log.info("Ensured rd_issue_task, project_task, and allocation task columns exist");
    }

    private void migrateAllocationTaskColumns(JdbcTemplate jdbc) {
        if (!tableExists(jdbc, "allocation")) {
            return;
        }
        addColumnIfMissing(jdbc, "allocation", "project_id", "CHAR(36) NULL AFTER employee_id");
        jdbc.update("""
                UPDATE allocation a
                INNER JOIN rd_issue i ON i.id = a.issue_id
                SET a.project_id = i.project_id
                WHERE a.project_id IS NULL
                """);
        if (!isNullable(jdbc, "allocation", "project_id")) {
            log.info("Making allocation.project_id nullable for non-project allocations");
            jdbc.execute("ALTER TABLE allocation MODIFY project_id CHAR(36) NULL");
        }
        addFkIfMissing(jdbc, "fk_alloc_project",
                "ALTER TABLE allocation ADD CONSTRAINT fk_alloc_project FOREIGN KEY (project_id) REFERENCES project(id)");

        if (!isNullable(jdbc, "allocation", "issue_id")) {
            jdbc.execute("ALTER TABLE allocation MODIFY issue_id CHAR(36) NULL");
        }

        addColumnIfMissing(jdbc, "allocation", "project_task_id", "CHAR(36) NULL AFTER issue_id");
        addFkIfMissing(jdbc, "fk_alloc_project_task",
                "ALTER TABLE allocation ADD CONSTRAINT fk_alloc_project_task FOREIGN KEY (project_task_id) REFERENCES project_task(id)");

        addColumnIfMissing(jdbc, "allocation", "rd_issue_task_id", "CHAR(36) NULL AFTER project_task_id");
        addFkIfMissing(jdbc, "fk_alloc_rd_issue_task",
                "ALTER TABLE allocation ADD CONSTRAINT fk_alloc_rd_issue_task FOREIGN KEY (rd_issue_task_id) REFERENCES rd_issue_task(id)");
    }

    private boolean tableExists(JdbcTemplate jdbc, String table) {
        Integer n = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM information_schema.tables
                WHERE table_schema = DATABASE() AND table_name = ?
                """,
                Integer.class,
                table);
        return n != null && n > 0;
    }

    private boolean columnExists(JdbcTemplate jdbc, String table, String column) {
        Integer n = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
                """,
                Integer.class,
                table,
                column);
        return n != null && n > 0;
    }

    private boolean isNullable(JdbcTemplate jdbc, String table, String column) {
        if (!columnExists(jdbc, table, column)) {
            return true;
        }
        String nullable = jdbc.queryForObject(
                """
                SELECT IS_NULLABLE FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
                """,
                String.class,
                table,
                column);
        return "YES".equalsIgnoreCase(nullable);
    }

    private void addColumnIfMissing(JdbcTemplate jdbc, String table, String column, String definition) {
        if (columnExists(jdbc, table, column)) {
            return;
        }
        jdbc.execute("ALTER TABLE " + table + " ADD COLUMN " + column + " " + definition);
    }

    private void addFkIfMissing(JdbcTemplate jdbc, String constraintName, String sql) {
        Integer n = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM information_schema.table_constraints
                WHERE table_schema = DATABASE() AND constraint_name = ?
                """,
                Integer.class,
                constraintName);
        if (n != null && n > 0) {
            return;
        }
        jdbc.execute(sql);
    }
}

package com.nexuspm.shared.bootstrap;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;

/**
 * Creates project_type / work_category, work_category_manager, project_type_id,
 * and project.work_category_id before Hibernate validate.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@Slf4j
public class ProjectTypeWorkCategorySchemaMigrator implements BeanPostProcessor {

    private static final String LOOKUP_DDL = """
            CREATE TABLE %s (
                id          CHAR(36)     NOT NULL PRIMARY KEY,
                name        VARCHAR(150) NOT NULL UNIQUE,
                description VARCHAR(500) NULL,
                sort_order  INT          NOT NULL DEFAULT 0,
                created_by  CHAR(36)     NULL,
                updated_by  CHAR(36)     NULL,
                created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """;

    private static final String MANAGER_DDL = """
            CREATE TABLE work_category_manager (
                id                                   CHAR(36) NOT NULL PRIMARY KEY,
                work_category_id                     CHAR(36) NOT NULL,
                engineering_manager_management_id    CHAR(36) NOT NULL,
                UNIQUE KEY uk_work_category_manager (work_category_id, engineering_manager_management_id),
                CONSTRAINT fk_wcm_category FOREIGN KEY (work_category_id) REFERENCES work_category(id) ON DELETE CASCADE,
                CONSTRAINT fk_wcm_manager  FOREIGN KEY (engineering_manager_management_id) REFERENCES team_management(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """;

    private volatile boolean migrated;

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {
        if (migrated || !(bean instanceof DataSource dataSource)) {
            return bean;
        }
        if (!beanName.toLowerCase().contains("datasource")) {
            return bean;
        }
        migrated = true;
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            ensureLookupTable(statement, "project_type");
            ensureLookupTable(statement, "work_category");
            seedProjectTypes(statement);
            seedWorkCategories(statement);
            if (tableExists(statement, "project")) {
                ensureColumn(statement, "project", "project_type_id",
                        "ALTER TABLE project ADD COLUMN project_type_id CHAR(36) NULL AFTER product");
                ensureFk(statement, "project", "fk_project_type",
                        "ALTER TABLE project ADD CONSTRAINT fk_project_type "
                                + "FOREIGN KEY (project_type_id) REFERENCES project_type(id)");
                statement.execute(
                        """
                        UPDATE project p
                        JOIN project_type t ON UPPER(TRIM(p.product)) = UPPER(t.name)
                        SET p.project_type_id = t.id
                        WHERE p.project_type_id IS NULL
                          AND t.name IN ('NTP', 'GBL')
                        """);
            }
            if (tableExists(statement, "work_category") && tableExists(statement, "team_management")) {
                ensureTable(statement, "work_category_manager", MANAGER_DDL);
                backfillManagersFromProjects(statement);
            }
            ensureProjectWorkCategory(statement);
            ensureAllocationWorkCategory(statement);
        } catch (Exception e) {
            migrated = false;
            throw new IllegalStateException("Failed to ensure project_type / work_category tables", e);
        }
        return bean;
    }

    private void ensureLookupTable(Statement statement, String table) throws Exception {
        if (tableExists(statement, table)) {
            return;
        }
        log.info("Creating {} table (pre-JPA)", table);
        statement.execute(LOOKUP_DDL.formatted(table));
    }

    private void ensureTable(Statement statement, String table, String ddl) throws Exception {
        if (tableExists(statement, table)) {
            return;
        }
        log.info("Creating {} table (pre-JPA)", table);
        statement.execute(ddl);
    }

    private void seedProjectTypes(Statement statement) throws Exception {
        statement.execute(
                """
                INSERT IGNORE INTO project_type (id, name, sort_order) VALUES
                ('d1000001-0000-0000-0000-000000000001', 'NTP', 1),
                ('d1000001-0000-0000-0000-000000000002', 'GBL', 2),
                ('d1000001-0000-0000-0000-000000000003', 'Client Project', 3)
                """);
    }

    private void seedWorkCategories(Statement statement) throws Exception {
        statement.execute(
                """
                INSERT IGNORE INTO work_category (id, name, sort_order) VALUES
                ('e1000001-0000-0000-0000-000000000001', 'Global BMS L3 Support', 1),
                ('e1000001-0000-0000-0000-000000000002', 'Global BMS KTLO', 2),
                ('e1000001-0000-0000-0000-000000000003', 'BAU - ALL KSA GBL', 3),
                ('e1000001-0000-0000-0000-000000000004', 'Dedicated Allocation', 4),
                ('e1000001-0000-0000-0000-000000000005', 'KSA NTP BAU Team 01', 5),
                ('e1000001-0000-0000-0000-000000000006', 'KSA NTP BAU Team 02', 6),
                ('e1000001-0000-0000-0000-000000000007', 'BMS Product Development NTP 2.0', 7),
                ('e1000001-0000-0000-0000-000000000008', 'BMS - None Functional Development', 8),
                ('e1000001-0000-0000-0000-000000000009', 'DT/PRO - BMS', 9),
                ('e1000001-0000-0000-0000-000000000010', 'DFNOne + PRO Retails', 10),
                ('e1000001-0000-0000-0000-000000000011', 'MBE Products', 11),
                ('e1000001-0000-0000-0000-000000000012', 'CMS Product', 12),
                ('e1000001-0000-0000-0000-000000000013', 'UA Product', 13),
                ('e1000001-0000-0000-0000-000000000014', 'International - BAU RDs only', 14),
                ('e1000001-0000-0000-0000-000000000015', 'ASIA and Africa - All GBL and NTP clients', 15),
                ('e1000001-0000-0000-0000-000000000016', 'GCC GBL', 16),
                ('e1000001-0000-0000-0000-000000000017', 'GCC NTP', 17)
                """);
    }

    private void backfillManagersFromProjects(Statement statement) throws Exception {
        if (!columnExists(statement, "project", "work_category_id")) {
            return;
        }
        log.info("Backfilling work_category_manager from project.work_category_id");
        statement.execute(
                """
                INSERT IGNORE INTO work_category_manager (
                    id, work_category_id, engineering_manager_management_id)
                SELECT UUID(), p.work_category_id, p.engineering_manager_management_id
                FROM project p
                WHERE p.work_category_id IS NOT NULL
                  AND p.engineering_manager_management_id IS NOT NULL
                """);
    }

    private void ensureProjectWorkCategory(Statement statement) throws Exception {
        if (!tableExists(statement, "project") || !tableExists(statement, "work_category")) {
            return;
        }
        ensureColumn(statement, "project", "work_category_id",
                "ALTER TABLE project ADD COLUMN work_category_id CHAR(36) NULL AFTER project_type_id");
        ensureFk(statement, "project", "fk_project_work_category",
                "ALTER TABLE project ADD CONSTRAINT fk_project_work_category "
                        + "FOREIGN KEY (work_category_id) REFERENCES work_category(id)");
    }

    private void ensureAllocationWorkCategory(Statement statement) throws Exception {
        if (!tableExists(statement, "allocation") || !tableExists(statement, "work_category")) {
            return;
        }
        ensureColumn(statement, "allocation", "work_category_id",
                "ALTER TABLE allocation ADD COLUMN work_category_id CHAR(36) NULL AFTER task_category_id");
        ensureFk(statement, "allocation", "fk_alloc_work_category",
                "ALTER TABLE allocation ADD CONSTRAINT fk_alloc_work_category "
                        + "FOREIGN KEY (work_category_id) REFERENCES work_category(id)");
        if (columnExists(statement, "project", "work_category_id")) {
            log.info("Backfilling allocation.work_category_id from project");
            statement.execute(
                    """
                    UPDATE allocation a
                    JOIN project p ON a.project_id = p.id
                    SET a.work_category_id = p.work_category_id
                    WHERE a.work_category_id IS NULL
                      AND p.work_category_id IS NOT NULL
                    """);
        }
    }

    private boolean tableExists(Statement statement, String table) throws Exception {
        try (ResultSet rs = statement.executeQuery(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '"
                        + table + "'")) {
            rs.next();
            return rs.getInt(1) > 0;
        }
    }

    private boolean columnExists(Statement statement, String table, String column) throws Exception {
        try (ResultSet rs = statement.executeQuery(
                """
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = '%s' AND column_name = '%s'
                """.formatted(table, column))) {
            rs.next();
            return rs.getInt(1) > 0;
        }
    }

    private boolean constraintExists(Statement statement, String table, String constraint) throws Exception {
        try (ResultSet rs = statement.executeQuery(
                """
                SELECT COUNT(*) FROM information_schema.table_constraints
                WHERE table_schema = DATABASE() AND table_name = '%s' AND constraint_name = '%s'
                """.formatted(table, constraint))) {
            rs.next();
            return rs.getInt(1) > 0;
        }
    }

    private void ensureColumn(Statement statement, String table, String column, String ddl) throws Exception {
        if (!columnExists(statement, table, column)) {
            log.info("Adding {}.{} (pre-JPA)", table, column);
            statement.execute(ddl);
        }
    }

    private void ensureFk(Statement statement, String table, String constraint, String ddl) throws Exception {
        if (!constraintExists(statement, table, constraint)) {
            log.info("Adding {} (pre-JPA)", constraint);
            statement.execute(ddl);
        }
    }
}

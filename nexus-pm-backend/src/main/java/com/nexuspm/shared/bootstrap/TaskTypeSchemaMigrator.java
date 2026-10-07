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
 * Creates task_type and seeds defaults before Hibernate schema validation.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@Slf4j
public class TaskTypeSchemaMigrator implements BeanPostProcessor {

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
            try (ResultSet rs = statement.executeQuery(
                    """
                    SELECT COUNT(*) FROM information_schema.tables
                    WHERE table_schema = DATABASE() AND table_name = 'task_type'
                    """)) {
                rs.next();
                if (rs.getInt(1) == 0) {
                    log.info("Creating task_type table (pre-JPA)");
                    statement.execute(
                            """
                            CREATE TABLE task_type (
                                id          CHAR(36)     NOT NULL PRIMARY KEY,
                                name        VARCHAR(150) NOT NULL UNIQUE,
                                description VARCHAR(500) NULL,
                                sort_order  INT          NOT NULL DEFAULT 0,
                                created_by  CHAR(36)     NULL,
                                updated_by  CHAR(36)     NULL,
                                created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                            """);
                }
            }
            try (ResultSet rs = statement.executeQuery("SELECT COUNT(*) FROM task_type")) {
                rs.next();
                if (rs.getInt(1) == 0) {
                    log.info("Seeding default task types");
                    statement.execute(
                            """
                            INSERT INTO task_type (id, name, description, sort_order) VALUES
                            ('a1000001-0000-0000-0000-000000000001', 'Roadmap / new features', NULL, 1),
                            ('a1000001-0000-0000-0000-000000000002', 'Maintenance', NULL, 2),
                            ('a1000001-0000-0000-0000-000000000006', 'Upgrades', NULL, 3),
                            ('a1000001-0000-0000-0000-000000000007', 'Bugs', NULL, 4),
                            ('a1000001-0000-0000-0000-000000000003', 'Tech debt', NULL, 5),
                            ('a1000001-0000-0000-0000-000000000008', 'Platform improvement', NULL, 6),
                            ('a1000001-0000-0000-0000-000000000004', 'Support', NULL, 7),
                            ('a1000001-0000-0000-0000-000000000005', 'Other', NULL, 8)
                            """);
                } else {
                    statement.execute(
                            """
                            UPDATE task_type SET name = 'Maintenance', sort_order = 2
                            WHERE name = 'Maintenance, upgrades, bugs'
                               OR id = 'a1000001-0000-0000-0000-000000000002'
                            """);
                    statement.execute(
                            """
                            UPDATE task_type SET name = 'Tech debt', sort_order = 5
                            WHERE name = 'Tech debt / platform improvement'
                               OR id = 'a1000001-0000-0000-0000-000000000003'
                            """);
                    statement.execute(
                            """
                            UPDATE task_type SET name = 'Support', sort_order = 7
                            WHERE name = 'Support, incidents, on-call'
                               OR id = 'a1000001-0000-0000-0000-000000000004'
                            """);
                    statement.execute(
                            """
                            INSERT IGNORE INTO task_type (id, name, description, sort_order) VALUES
                            ('a1000001-0000-0000-0000-000000000006', 'Upgrades', NULL, 3),
                            ('a1000001-0000-0000-0000-000000000007', 'Bugs', NULL, 4),
                            ('a1000001-0000-0000-0000-000000000008', 'Platform improvement', NULL, 6)
                            """);
                    statement.execute(
                            "UPDATE task_type SET sort_order = 8 WHERE id = 'a1000001-0000-0000-0000-000000000005'");
                }
            }
            try (ResultSet rs = statement.executeQuery(
                    """
                    SELECT COUNT(*) FROM information_schema.tables
                    WHERE table_schema = DATABASE() AND table_name = 'task_category'
                    """)) {
                rs.next();
                if (rs.getInt(1) == 0) {
                    log.info("Creating task_category table (pre-JPA)");
                    statement.execute(
                            """
                            CREATE TABLE task_category (
                                id          CHAR(36)     NOT NULL PRIMARY KEY,
                                name        VARCHAR(150) NOT NULL UNIQUE,
                                description VARCHAR(500) NULL,
                                sort_order  INT          NOT NULL DEFAULT 0,
                                created_by  CHAR(36)     NULL,
                                updated_by  CHAR(36)     NULL,
                                created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                            """);
                }
            }
            try (ResultSet rs = statement.executeQuery("SELECT COUNT(*) FROM task_category")) {
                rs.next();
                if (rs.getInt(1) == 0) {
                    log.info("Seeding default task categories");
                    statement.execute(
                            """
                            INSERT INTO task_category (id, name, description, sort_order) VALUES
                            ('b1000001-0000-0000-0000-000000000001', 'Project related', NULL, 1),
                            ('b1000001-0000-0000-0000-000000000002', 'Non-Project Related', NULL, 2)
                            """);
                }
            }
            boolean allocationExists;
            try (ResultSet rs = statement.executeQuery(
                    """
                    SELECT COUNT(*) FROM information_schema.tables
                    WHERE table_schema = DATABASE() AND table_name = 'allocation'
                    """)) {
                rs.next();
                allocationExists = rs.getInt(1) > 0;
            }
            if (allocationExists) {
                try (ResultSet rs = statement.executeQuery(
                        """
                        SELECT COUNT(*) FROM information_schema.columns
                        WHERE table_schema = DATABASE()
                          AND table_name = 'allocation'
                          AND column_name = 'task_type_id'
                        """)) {
                    rs.next();
                    if (rs.getInt(1) == 0) {
                        log.info("Adding allocation.task_type_id column (pre-JPA)");
                        statement.execute(
                                "ALTER TABLE allocation ADD COLUMN task_type_id CHAR(36) NULL AFTER rd_issue_task_id");
                    }
                }
                try (ResultSet rs = statement.executeQuery(
                        """
                        SELECT COUNT(*) FROM information_schema.table_constraints
                        WHERE table_schema = DATABASE()
                          AND table_name = 'allocation'
                          AND constraint_name = 'fk_alloc_task_type'
                        """)) {
                    rs.next();
                    if (rs.getInt(1) == 0) {
                        log.info("Adding fk_alloc_task_type on allocation.task_type_id (pre-JPA)");
                        statement.execute(
                                "ALTER TABLE allocation ADD CONSTRAINT fk_alloc_task_type "
                                        + "FOREIGN KEY (task_type_id) REFERENCES task_type(id)");
                    }
                }
                try (ResultSet rs = statement.executeQuery(
                        """
                        SELECT COUNT(*) FROM information_schema.columns
                        WHERE table_schema = DATABASE()
                          AND table_name = 'allocation'
                          AND column_name = 'task_category_id'
                        """)) {
                    rs.next();
                    if (rs.getInt(1) == 0) {
                        log.info("Adding allocation.task_category_id column (pre-JPA)");
                        statement.execute(
                                "ALTER TABLE allocation ADD COLUMN task_category_id CHAR(36) NULL AFTER task_type_id");
                    }
                }
                try (ResultSet rs = statement.executeQuery(
                        """
                        SELECT COUNT(*) FROM information_schema.table_constraints
                        WHERE table_schema = DATABASE()
                          AND table_name = 'allocation'
                          AND constraint_name = 'fk_alloc_task_category'
                        """)) {
                    rs.next();
                    if (rs.getInt(1) == 0) {
                        log.info("Adding fk_alloc_task_category on allocation.task_category_id (pre-JPA)");
                        statement.execute(
                                "ALTER TABLE allocation ADD CONSTRAINT fk_alloc_task_category "
                                        + "FOREIGN KEY (task_category_id) REFERENCES task_category(id)");
                    }
                }
                try (ResultSet rs = statement.executeQuery(
                        """
                        SELECT COUNT(*) FROM information_schema.tables
                        WHERE table_schema = DATABASE() AND table_name = 'non_project_task'
                        """)) {
                    rs.next();
                    if (rs.getInt(1) == 0) {
                        log.info("Creating non_project_task table (pre-JPA)");
                        statement.execute(
                                """
                                CREATE TABLE non_project_task (
                                    id              CHAR(36)     NOT NULL PRIMARY KEY,
                                    description     TEXT         NOT NULL,
                                    module          VARCHAR(120) NULL,
                                    deleted         TINYINT(1)   NOT NULL DEFAULT 0,
                                    version         BIGINT       NOT NULL DEFAULT 0,
                                    created_by      CHAR(36)     NULL,
                                    updated_by      CHAR(36)     NULL,
                                    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                                """);
                    }
                }
                try (ResultSet rs = statement.executeQuery(
                        """
                        SELECT COUNT(*) FROM information_schema.columns
                        WHERE table_schema = DATABASE()
                          AND table_name = 'allocation'
                          AND column_name = 'project_id'
                          AND is_nullable = 'NO'
                        """)) {
                    rs.next();
                    if (rs.getInt(1) > 0) {
                        log.info("Making allocation.project_id nullable for non-project work (pre-JPA)");
                        statement.execute("ALTER TABLE allocation MODIFY project_id CHAR(36) NULL");
                    }
                }
                try (ResultSet rs = statement.executeQuery(
                        """
                        SELECT COUNT(*) FROM information_schema.columns
                        WHERE table_schema = DATABASE()
                          AND table_name = 'allocation'
                          AND column_name = 'non_project_task_id'
                        """)) {
                    rs.next();
                    if (rs.getInt(1) == 0) {
                        log.info("Adding allocation.non_project_task_id column (pre-JPA)");
                        statement.execute(
                                "ALTER TABLE allocation ADD COLUMN non_project_task_id CHAR(36) NULL AFTER task_category_id");
                    }
                }
                try (ResultSet rs = statement.executeQuery(
                        """
                        SELECT COUNT(*) FROM information_schema.table_constraints
                        WHERE table_schema = DATABASE()
                          AND table_name = 'allocation'
                          AND constraint_name = 'fk_alloc_non_project_task'
                        """)) {
                    rs.next();
                    if (rs.getInt(1) == 0) {
                        log.info("Adding fk_alloc_non_project_task on allocation.non_project_task_id (pre-JPA)");
                        statement.execute(
                                "ALTER TABLE allocation ADD CONSTRAINT fk_alloc_non_project_task "
                                        + "FOREIGN KEY (non_project_task_id) REFERENCES non_project_task(id)");
                    }
                }
            }
        } catch (Exception e) {
            migrated = false;
            throw new IllegalStateException("Failed to ensure task_type table", e);
        }
        return bean;
    }
}

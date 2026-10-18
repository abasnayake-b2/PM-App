package com.nexuspm.shared.bootstrap;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.UUID;

/**
 * Creates employee_manager_assignment and backfills current EM rows before Hibernate validate.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@Slf4j
public class EmployeeManagerAssignmentSchemaMigrator implements BeanPostProcessor {

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
                    WHERE table_schema = DATABASE() AND table_name = 'employee_manager_assignment'
                    """)) {
                rs.next();
                if (rs.getInt(1) == 0) {
                    log.info("Creating employee_manager_assignment table (pre-JPA)");
                    statement.execute(
                            """
                            CREATE TABLE employee_manager_assignment (
                                id                                   CHAR(36)    NOT NULL PRIMARY KEY,
                                employee_id                          CHAR(36)    NOT NULL,
                                engineering_manager_management_id    CHAR(36)    NULL,
                                from_date                            DATE        NOT NULL,
                                to_date                              DATE        NULL,
                                source                               VARCHAR(20) NOT NULL DEFAULT 'UI',
                                created_by                           CHAR(36)    NULL,
                                updated_by                           CHAR(36)    NULL,
                                created_at                           TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                updated_at                           TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                                KEY idx_ema_employee_from (employee_id, from_date),
                                KEY idx_ema_manager_from (engineering_manager_management_id, from_date),
                                CONSTRAINT fk_ema_employee FOREIGN KEY (employee_id) REFERENCES employee(id) ON DELETE CASCADE,
                                CONSTRAINT fk_ema_manager  FOREIGN KEY (engineering_manager_management_id) REFERENCES team_management(id) ON DELETE SET NULL
                            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                            """);
                }
            }
            backfillCurrentAssignments(connection);
        } catch (Exception e) {
            migrated = false;
            throw new IllegalStateException("Failed to ensure employee_manager_assignment table", e);
        }
        return bean;
    }

    private void backfillCurrentAssignments(Connection connection) throws Exception {
        String insert = """
                INSERT INTO employee_manager_assignment (
                    id, employee_id, engineering_manager_management_id, from_date, to_date, source)
                VALUES (?, ?, ?, COALESCE(?, CURRENT_DATE), NULL, 'BACKFILL')
                """;
        try (Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery(
                     """
                     SELECT e.id, e.engineering_manager_management_id, DATE(e.created_at)
                     FROM employee e
                     WHERE e.team_management_id IS NULL
                       AND NOT EXISTS (
                           SELECT 1 FROM employee_manager_assignment a
                           WHERE a.employee_id = e.id
                       )
                     """);
             PreparedStatement ps = connection.prepareStatement(insert)) {
            int count = 0;
            while (rs.next()) {
                ps.setString(1, UUID.randomUUID().toString());
                ps.setString(2, rs.getString(1));
                ps.setString(3, rs.getString(2));
                ps.setDate(4, rs.getDate(3));
                ps.addBatch();
                count++;
                if (count % 200 == 0) {
                    ps.executeBatch();
                }
            }
            if (count > 0) {
                ps.executeBatch();
                log.info("Backfilled {} employee_manager_assignment rows from current roster", count);
            }
        }
    }
}

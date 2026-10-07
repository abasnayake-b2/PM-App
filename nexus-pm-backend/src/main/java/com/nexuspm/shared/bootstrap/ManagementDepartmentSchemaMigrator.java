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
 * Adds team_management.department_id before Hibernate schema validation.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@Slf4j
public class ManagementDepartmentSchemaMigrator implements BeanPostProcessor {

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
                    SELECT COUNT(*) FROM information_schema.columns
                    WHERE table_schema = DATABASE()
                      AND table_name = 'team_management'
                      AND column_name = 'department_id'
                    """)) {
                rs.next();
                if (rs.getInt(1) == 0) {
                    log.info("Adding team_management.department_id column (pre-JPA)");
                    statement.execute(
                            "ALTER TABLE team_management ADD COLUMN department_id CHAR(36) NULL AFTER employment_type");
                }
            }
            try (ResultSet rs = statement.executeQuery(
                    """
                    SELECT COUNT(*) FROM information_schema.table_constraints
                    WHERE table_schema = DATABASE()
                      AND table_name = 'team_management'
                      AND constraint_name = 'fk_tm_department'
                    """)) {
                rs.next();
                if (rs.getInt(1) == 0) {
                    log.info("Adding fk_tm_department on team_management.department_id (pre-JPA)");
                    statement.execute(
                            "ALTER TABLE team_management ADD CONSTRAINT fk_tm_department "
                                    + "FOREIGN KEY (department_id) REFERENCES department(id)");
                }
            }
        } catch (Exception e) {
            migrated = false;
            throw new IllegalStateException("Failed to ensure team_management.department_id column", e);
        }
        return bean;
    }
}

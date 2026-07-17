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
 * Adds employee.profile_picture before Hibernate schema validation.
 * ApplicationRunner is too late when ddl-auto=validate.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@Slf4j
public class EmployeeProfilePictureSchemaMigrator implements BeanPostProcessor {

    private volatile boolean migrated;

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {
        if (migrated || !(bean instanceof DataSource dataSource)) {
            return bean;
        }
        // Only migrate the primary pooled DataSource, not wrappers created later.
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
                      AND table_name = 'employee'
                      AND column_name = 'profile_picture'
                    """)) {
                rs.next();
                if (rs.getInt(1) > 0) {
                    return bean;
                }
            }
            log.info("Adding employee.profile_picture column (pre-JPA)");
            statement.execute("ALTER TABLE employee ADD COLUMN profile_picture VARCHAR(255) NULL");
        } catch (Exception e) {
            migrated = false;
            throw new IllegalStateException("Failed to ensure employee.profile_picture column", e);
        }
        return bean;
    }
}

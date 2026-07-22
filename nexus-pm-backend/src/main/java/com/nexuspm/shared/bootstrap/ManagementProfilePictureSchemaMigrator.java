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
 * Adds team_management.profile_picture before Hibernate schema validation.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@Slf4j
public class ManagementProfilePictureSchemaMigrator implements BeanPostProcessor {

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
                      AND column_name = 'profile_picture'
                    """)) {
                rs.next();
                if (rs.getInt(1) > 0) {
                    return bean;
                }
            }
            log.info("Adding team_management.profile_picture column (pre-JPA)");
            statement.execute("ALTER TABLE team_management ADD COLUMN profile_picture VARCHAR(255) NULL");
        } catch (Exception e) {
            migrated = false;
            throw new IllegalStateException("Failed to ensure team_management.profile_picture column", e);
        }
        return bean;
    }
}

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
 * Ensures em_capacity_plan exists before Hibernate schema validation.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@Slf4j
public class EmCapacityPlanSchemaMigrator implements BeanPostProcessor {

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
                    WHERE table_schema = DATABASE()
                      AND table_name = 'em_capacity_plan'
                    """)) {
                rs.next();
                if (rs.getInt(1) > 0) {
                    return bean;
                }
            }
            log.info("Creating em_capacity_plan table (pre-JPA)");
            statement.execute("""
                    CREATE TABLE em_capacity_plan (
                        id                    CHAR(36)  NOT NULL PRIMARY KEY,
                        em_management_id      CHAR(36)  NOT NULL,
                        additional_resources  INT       NOT NULL DEFAULT 0,
                        created_by            CHAR(36)  NULL,
                        updated_by            CHAR(36)  NULL,
                        created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        UNIQUE KEY uk_em_capacity_plan_em (em_management_id),
                        CONSTRAINT fk_em_capacity_plan_em
                            FOREIGN KEY (em_management_id) REFERENCES team_management(id)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                    """);
        } catch (Exception e) {
            migrated = false;
            throw new IllegalStateException("Failed to ensure em_capacity_plan table", e);
        }
        return bean;
    }
}

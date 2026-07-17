package com.nexuspm.shared.bootstrap;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Ensures the skill reference table exists when Liquibase is disabled.
 */
@Component
@Order(25)
@RequiredArgsConstructor
@Slf4j
public class SkillTableBootstrapRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM information_schema.tables
                WHERE table_schema = DATABASE() AND table_name = 'skill'
                """,
                Integer.class);
        if (count == null || count == 0) {
            log.info("Creating skill reference table");
            jdbcTemplate.execute(
                    """
                    CREATE TABLE skill (
                        id          CHAR(36)     NOT NULL PRIMARY KEY,
                        name        VARCHAR(100) NOT NULL UNIQUE,
                        description VARCHAR(500) NULL,
                        created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    )
                    """);
            return;
        }

        Integer descriptionCount = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = 'skill'
                  AND column_name = 'description'
                """,
                Integer.class);
        if (descriptionCount == null || descriptionCount == 0) {
            log.info("Adding description column to skill table");
            jdbcTemplate.execute("ALTER TABLE skill ADD COLUMN description VARCHAR(500) NULL");
        }
    }
}

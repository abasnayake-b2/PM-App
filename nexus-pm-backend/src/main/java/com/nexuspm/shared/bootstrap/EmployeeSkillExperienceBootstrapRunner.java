package com.nexuspm.shared.bootstrap;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Ensures employee experience columns and employee_skill exist when Liquibase is disabled.
 */
@Component
@Order(26)
@RequiredArgsConstructor
@Slf4j
public class EmployeeSkillExperienceBootstrapRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        ensureColumn("total_years_of_experience", "DECIMAL(5,1) NULL");
        ensureColumn("experience_in_dfn", "DECIMAL(5,1) NULL");
        ensureEmployeeSkillTable();
    }

    private void ensureColumn(String columnName, String definition) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = 'employee'
                  AND column_name = ?
                """,
                Integer.class,
                columnName);
        if (count == null || count == 0) {
            log.info("Adding employee.{} column", columnName);
            jdbcTemplate.execute("ALTER TABLE employee ADD COLUMN " + columnName + " " + definition);
        }
    }

    private void ensureEmployeeSkillTable() {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM information_schema.tables
                WHERE table_schema = DATABASE() AND table_name = 'employee_skill'
                """,
                Integer.class);
        if (count != null && count > 0) {
            return;
        }
        log.info("Creating employee_skill table");
        jdbcTemplate.execute(
                """
                CREATE TABLE employee_skill (
                    employee_id CHAR(36) NOT NULL,
                    skill_id    CHAR(36) NOT NULL,
                    PRIMARY KEY (employee_id, skill_id),
                    CONSTRAINT fk_es_employee FOREIGN KEY (employee_id) REFERENCES employee(id),
                    CONSTRAINT fk_es_skill    FOREIGN KEY (skill_id)    REFERENCES skill(id)
                )
                """);
    }
}

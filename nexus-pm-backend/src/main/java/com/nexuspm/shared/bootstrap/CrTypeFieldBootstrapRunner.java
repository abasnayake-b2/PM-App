package com.nexuspm.shared.bootstrap;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Ensures CR Type custom field exists for Capacity Planning chargeable vs AMC split.
 */
@Component
@Order(40)
@RequiredArgsConstructor
@Slf4j
public class CrTypeFieldBootstrapRunner implements ApplicationRunner {

    private static final String FIELD_ID = "c1000001-0000-0000-0000-000000000008";

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM issue_field_definition WHERE field_key = ?",
                Integer.class,
                "cr_type");
        if (count != null && count > 0) {
            return;
        }
        log.info("Seeding issue_field_definition.cr_type for Capacity Planning");
        jdbcTemplate.update("""
                INSERT INTO issue_field_definition
                (id, field_key, label, data_type, max_length, required, active, system_field, section_code, display_order, options_json)
                VALUES (?, 'cr_type', 'CR Type', 'DROPDOWN', NULL, 0, 1, 1, 'GENERAL', 25, ?)
                """,
                FIELD_ID,
                "[\"CR\",\"AMC\"]");
    }
}

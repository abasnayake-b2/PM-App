-- =============================================================================
-- DFN-PlanX — Schema rebuild (empty tables only; no seed data)
--
-- Usage:
--   mysql -u root -p < build.sql
--   mysql -u root -p < seed.sql
--
-- Sources: JPA entities, Liquibase 001–011, bootstrap runners, live schema.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS dfn_pm
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE dfn_pm;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS em_capacity_plan;
DROP TABLE IF EXISTS password_reset_token;
DROP TABLE IF EXISTS refresh_token;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS notification;
DROP TABLE IF EXISTS ai_tool_catalog;
DROP TABLE IF EXISTS system_settings;
DROP TABLE IF EXISTS notification_template;
DROP TABLE IF EXISTS workflow_rule;
DROP TABLE IF EXISTS holiday_calendar;
DROP TABLE IF EXISTS time_log;
DROP TABLE IF EXISTS allocation;
DROP TABLE IF EXISTS task;
DROP TABLE IF EXISTS issue_field_value;
DROP TABLE IF EXISTS issue_field_definition;
DROP TABLE IF EXISTS rd_issue;
DROP TABLE IF EXISTS project_health_log;
DROP TABLE IF EXISTS project_access;
DROP TABLE IF EXISTS budget;
DROP TABLE IF EXISTS `release`;
DROP TABLE IF EXISTS project;
DROP TABLE IF EXISTS issue_status;
DROP TABLE IF EXISTS issue_type;
DROP TABLE IF EXISTS priority;
DROP TABLE IF EXISTS user_auth;
DROP TABLE IF EXISTS employee_skill;
DROP TABLE IF EXISTS employee_role;
DROP TABLE IF EXISTS employee;
DROP TABLE IF EXISTS team_management;
DROP TABLE IF EXISTS team_import_batch;
DROP TABLE IF EXISTS role_permission;
DROP TABLE IF EXISTS permission;
DROP TABLE IF EXISTS role;
DROP TABLE IF EXISTS org_level;
DROP TABLE IF EXISTS designation;
DROP TABLE IF EXISTS skill;
DROP TABLE IF EXISTS work_type;
DROP TABLE IF EXISTS stream;
DROP TABLE IF EXISTS department;
DROP TABLE IF EXISTS client;
DROP TABLE IF EXISTS country;
DROP TABLE IF EXISTS region;

SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- Geography
-- -----------------------------------------------------------------------------

CREATE TABLE region (
    id          CHAR(36)     NOT NULL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    code        VARCHAR(10)  NOT NULL UNIQUE,
    deleted     TINYINT(1)   NOT NULL DEFAULT 0,
    created_by  CHAR(36)     NULL,
    updated_by  CHAR(36)     NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE country (
    id          CHAR(36)     NOT NULL PRIMARY KEY,
    region_id   CHAR(36)     NOT NULL,
    name        VARCHAR(100) NOT NULL,
    code        VARCHAR(10)  NOT NULL,
    deleted     TINYINT(1)   NOT NULL DEFAULT 0,
    created_by  CHAR(36)     NULL,
    updated_by  CHAR(36)     NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_country_region FOREIGN KEY (region_id) REFERENCES region(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE client (
    id          CHAR(36)     NOT NULL PRIMARY KEY,
    country_id  CHAR(36)     NOT NULL,
    name        VARCHAR(200) NOT NULL,
    status      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    deleted     TINYINT(1)   NOT NULL DEFAULT 0,
    created_by  CHAR(36)     NULL,
    updated_by  CHAR(36)     NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_client_country FOREIGN KEY (country_id) REFERENCES country(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Org reference data
-- -----------------------------------------------------------------------------

CREATE TABLE department (
    id          CHAR(36)     NOT NULL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    created_by  CHAR(36)     NULL,
    updated_by  CHAR(36)     NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stream (
    id            CHAR(36)     NOT NULL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL UNIQUE,
    department_id CHAR(36)     NOT NULL,
    created_by    CHAR(36)     NULL,
    updated_by    CHAR(36)     NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_stream_department FOREIGN KEY (department_id) REFERENCES department(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE work_type (
    id          CHAR(36)     NOT NULL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    created_by  CHAR(36)     NULL,
    updated_by  CHAR(36)     NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE skill (
    id          CHAR(36)     NOT NULL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(500) NULL,
    created_by  CHAR(36)     NULL,
    updated_by  CHAR(36)     NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE designation (
    id             CHAR(36)     NOT NULL PRIMARY KEY,
    name           VARCHAR(100) NOT NULL UNIQUE,
    code           VARCHAR(30)  NULL,
    department_id  CHAR(36)     NOT NULL,
    stream_id      CHAR(36)     NULL,
    is_management  TINYINT(1)   NOT NULL DEFAULT 0,
    created_by     CHAR(36)     NULL,
    updated_by     CHAR(36)     NULL,
    created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_designation_department FOREIGN KEY (department_id) REFERENCES department(id),
    CONSTRAINT fk_designation_stream     FOREIGN KEY (stream_id)     REFERENCES stream(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Org hierarchy: CXO → VP → Manager (Senior Manager or Manager) → Employee
-- role.org_level_id links org roles; employee.manager_id is the reporting line.
CREATE TABLE org_level (
    id                      CHAR(36)     NOT NULL PRIMARY KEY,
    code                    VARCHAR(30)  NOT NULL UNIQUE,
    name                    VARCHAR(50)  NOT NULL,
    level_order             INT          NOT NULL UNIQUE,
    reports_to_org_level_id CHAR(36)     NULL,
    created_by              CHAR(36)     NULL,
    updated_by              CHAR(36)     NULL,
    created_at              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_org_level_parent FOREIGN KEY (reports_to_org_level_id) REFERENCES org_level(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE role (
    id           CHAR(36)    NOT NULL PRIMARY KEY,
    name         VARCHAR(50) NOT NULL UNIQUE,
    code         VARCHAR(30) NOT NULL UNIQUE,
    org_level_id CHAR(36)    NULL,
    created_by   CHAR(36)    NULL,
    updated_by   CHAR(36)    NULL,
    created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_role_org_level FOREIGN KEY (org_level_id) REFERENCES org_level(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE permission (
    id          CHAR(36)     NOT NULL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    code        VARCHAR(50)  NOT NULL UNIQUE,
    module      VARCHAR(50)  NOT NULL,
    action      VARCHAR(20)  NOT NULL,
    created_by  CHAR(36)     NULL,
    updated_by  CHAR(36)     NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_permission_module_action (module, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE role_permission (
    role_id       CHAR(36) NOT NULL,
    permission_id CHAR(36) NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_rp_role       FOREIGN KEY (role_id)       REFERENCES role(id),
    CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id) REFERENCES permission(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Team roster (circular FK with employee.imported_by resolved after employee)
-- -----------------------------------------------------------------------------

CREATE TABLE team_import_batch (
    id               CHAR(36)     NOT NULL PRIMARY KEY,
    file_name        VARCHAR(255) NOT NULL,
    imported_by      CHAR(36)     NULL,
    management_count INT          NOT NULL DEFAULT 0,
    member_count     INT          NOT NULL DEFAULT 0,
    created_by       CHAR(36)     NULL,
    updated_by       CHAR(36)     NULL,
    created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE team_management (
    id              CHAR(36)     NOT NULL PRIMARY KEY,
    role_title      VARCHAR(120) NOT NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    supervisor_id   CHAR(36)     NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    profile_picture VARCHAR(255) NULL,
    import_batch_id CHAR(36)     NULL,
    created_by      CHAR(36)     NULL,
    updated_by      CHAR(36)     NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_tm_supervisor   FOREIGN KEY (supervisor_id)   REFERENCES team_management(id),
    CONSTRAINT fk_tm_import_batch FOREIGN KEY (import_batch_id) REFERENCES team_import_batch(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE employee (
    id                                  CHAR(36)     NOT NULL PRIMARY KEY,
    email                               VARCHAR(255) NULL,
    first_name                          VARCHAR(100) NOT NULL,
    last_name                           VARCHAR(100) NOT NULL,
    department_id                       CHAR(36)     NULL,
    designation_id                      CHAR(36)     NULL,
    stream_id                           CHAR(36)     NULL,
    work_type_id                        CHAR(36)     NULL,
    country_id                          CHAR(36)     NULL,
    engineering_manager_management_id   CHAR(36)     NULL,
    manager_id                          CHAR(36)     NULL,
    product                             VARCHAR(100) NULL,
    phone                               VARCHAR(50)  NULL,
    profile_picture                     VARCHAR(255) NULL,
    total_years_of_experience           DECIMAL(5,1) NULL,
    experience_in_dfn                   DECIMAL(5,1) NULL,
    import_batch_id                     CHAR(36)     NULL,
    team_management_id                  CHAR(36)     NULL,
    status                              VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    bench_status                        VARCHAR(20)  DEFAULT 'ASSIGNED',
    available_from                      DATE         NULL,
    org_wide_visibility                 TINYINT(1)   NOT NULL DEFAULT 0,
    version                             BIGINT       NOT NULL DEFAULT 0,
    created_by                          CHAR(36)     NULL,
    updated_by                          CHAR(36)     NULL,
    created_at                          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY email (email),
    UNIQUE KEY uk_employee_management (team_management_id),
    CONSTRAINT fk_employee_dept        FOREIGN KEY (department_id)                     REFERENCES department(id),
    CONSTRAINT fk_employee_designation FOREIGN KEY (designation_id)                    REFERENCES designation(id),
    CONSTRAINT fk_employee_stream      FOREIGN KEY (stream_id)                         REFERENCES stream(id),
    CONSTRAINT fk_employee_work_type   FOREIGN KEY (work_type_id)                      REFERENCES work_type(id),
    CONSTRAINT fk_employee_country     FOREIGN KEY (country_id)                        REFERENCES country(id),
    CONSTRAINT fk_employee_em_mgmt     FOREIGN KEY (engineering_manager_management_id) REFERENCES team_management(id),
    CONSTRAINT fk_employee_manager     FOREIGN KEY (manager_id)                        REFERENCES employee(id),
    CONSTRAINT fk_employee_import      FOREIGN KEY (import_batch_id)                   REFERENCES team_import_batch(id),
    CONSTRAINT fk_employee_management  FOREIGN KEY (team_management_id)                REFERENCES team_management(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE team_import_batch
    ADD CONSTRAINT fk_tib_imported_by FOREIGN KEY (imported_by) REFERENCES employee(id);

CREATE TABLE employee_role (
    employee_id CHAR(36) NOT NULL,
    role_id     CHAR(36) NOT NULL,
    PRIMARY KEY (employee_id, role_id),
    CONSTRAINT fk_er_employee FOREIGN KEY (employee_id) REFERENCES employee(id),
    CONSTRAINT fk_er_role     FOREIGN KEY (role_id)     REFERENCES role(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE employee_skill (
    employee_id CHAR(36) NOT NULL,
    skill_id    CHAR(36) NOT NULL,
    PRIMARY KEY (employee_id, skill_id),
    CONSTRAINT fk_es_employee FOREIGN KEY (employee_id) REFERENCES employee(id),
    CONSTRAINT fk_es_skill    FOREIGN KEY (skill_id)    REFERENCES skill(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_auth (
    id                   CHAR(36)     NOT NULL PRIMARY KEY,
    employee_id          CHAR(36)     NOT NULL UNIQUE,
    password_hash        VARCHAR(255) NOT NULL,
    password_changed_at  TIMESTAMP    NULL,
    failed_attempts      INT          NOT NULL DEFAULT 0,
    locked_until         TIMESTAMP    NULL,
    active               TINYINT(1)   NOT NULL DEFAULT 1,
    created_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_auth_employee FOREIGN KEY (employee_id) REFERENCES employee(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Delivery lookups
-- -----------------------------------------------------------------------------

CREATE TABLE priority (
    id               CHAR(36)    NOT NULL PRIMARY KEY,
    label            VARCHAR(30) NOT NULL UNIQUE,
    level            INT         NOT NULL,
    sla_response_hrs INT         NOT NULL,
    sla_resolve_hrs  INT         NOT NULL,
    colour           VARCHAR(10) NULL,
    created_at       TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE issue_type (
    id            CHAR(36)     NOT NULL PRIMARY KEY,
    name          VARCHAR(50)  NOT NULL UNIQUE,
    workflow_code VARCHAR(30)  NOT NULL,
    description   VARCHAR(255) NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE issue_status (
    id         CHAR(36)    NOT NULL PRIMARY KEY,
    name       VARCHAR(50) NOT NULL UNIQUE,
    sequence   INT         NOT NULL,
    terminal   TINYINT(1)  NOT NULL DEFAULT 0,
    colour     VARCHAR(10) NULL,
    created_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Projects / releases / issues
-- -----------------------------------------------------------------------------

CREATE TABLE project (
    id                                  CHAR(36)     NOT NULL PRIMARY KEY,
    client_id                           CHAR(36)     NOT NULL,
    name                                VARCHAR(200) NOT NULL,
    product                             VARCHAR(120) NULL,
    lead_employee_id                    CHAR(36)     NULL,
    architect_employee_id               CHAR(36)     NULL,
    engineering_manager_management_id   CHAR(36)     NULL,
    status                              VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    rag_status                          VARCHAR(10)  DEFAULT 'GREEN',
    progress_pct                        INT          DEFAULT 0,
    start_date                          DATE         NULL,
    end_date                            DATE         NULL,
    archived                            TINYINT(1)   NOT NULL DEFAULT 0,
    deleted                             TINYINT(1)   NOT NULL DEFAULT 0,
    version                             BIGINT       NOT NULL DEFAULT 0,
    created_by                          CHAR(36)     NULL,
    updated_by                          CHAR(36)     NULL,
    created_at                          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_project_client     FOREIGN KEY (client_id)                         REFERENCES client(id),
    CONSTRAINT fk_project_lead       FOREIGN KEY (lead_employee_id)                  REFERENCES employee(id),
    CONSTRAINT fk_project_architect  FOREIGN KEY (architect_employee_id)             REFERENCES employee(id),
    CONSTRAINT fk_project_em         FOREIGN KEY (engineering_manager_management_id) REFERENCES team_management(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE budget (
    id          CHAR(36)      NOT NULL PRIMARY KEY,
    project_id  CHAR(36)      NOT NULL UNIQUE,
    amount      DECIMAL(15,2) NULL,
    currency    VARCHAR(3)    DEFAULT 'USD',
    created_by  CHAR(36)      NULL,
    updated_by  CHAR(36)      NULL,
    created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_budget_project FOREIGN KEY (project_id) REFERENCES project(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `release` (
    id          CHAR(36)     NOT NULL PRIMARY KEY,
    project_id  CHAR(36)     NOT NULL,
    name        VARCHAR(100) NOT NULL,
    version     VARCHAR(50)  NULL,
    status      VARCHAR(20)  NOT NULL DEFAULT 'PLANNED',
    target_date DATE         NULL,
    created_by  CHAR(36)     NULL,
    updated_by  CHAR(36)     NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_release_project FOREIGN KEY (project_id) REFERENCES project(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE project_access (
    id           CHAR(36)    NOT NULL PRIMARY KEY,
    project_id   CHAR(36)    NOT NULL,
    employee_id  CHAR(36)    NOT NULL,
    access_level VARCHAR(20) NOT NULL DEFAULT 'VIEW',
    created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_project_employee (project_id, employee_id),
    CONSTRAINT fk_pa_project  FOREIGN KEY (project_id)  REFERENCES project(id),
    CONSTRAINT fk_pa_employee FOREIGN KEY (employee_id) REFERENCES employee(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE project_health_log (
    id          CHAR(36)    NOT NULL PRIMARY KEY,
    project_id  CHAR(36)    NOT NULL,
    rag_status  VARCHAR(10) NOT NULL,
    notes       TEXT        NULL,
    changed_by  CHAR(36)    NULL,
    created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_phl_project  FOREIGN KEY (project_id) REFERENCES project(id),
    CONSTRAINT fk_phl_employee FOREIGN KEY (changed_by) REFERENCES employee(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE rd_issue (
    id                   CHAR(36)      NOT NULL PRIMARY KEY,
    project_id           CHAR(36)      NOT NULL,
    release_id           CHAR(36)      NULL,
    parent_issue_id      CHAR(36)      NULL,
    display_key          VARCHAR(120)  NOT NULL,
    rd_number            INT           NOT NULL,
    child_number         INT           NULL,
    title                VARCHAR(255)  NOT NULL,
    jira_id              VARCHAR(80)   NULL,
    description          TEXT          NULL,
    issue_type_id        CHAR(36)      NOT NULL,
    priority_id          CHAR(36)      NOT NULL,
    status_id            CHAR(36)      NOT NULL,
    reported_by          CHAR(36)      NULL,
    assigned_to          CHAR(36)      NULL,
    original_estimation  DECIMAL(10,2) NULL,
    actual_estimation    DECIMAL(10,2) NULL,
    capitalizable        TINYINT(1)    NULL,
    component            VARCHAR(100)  NULL,
    sla_due_at           TIMESTAMP     NULL,
    sla_status           VARCHAR(20)   DEFAULT 'WITHIN',
    deleted              TINYINT(1)    NOT NULL DEFAULT 0,
    version              BIGINT        NOT NULL DEFAULT 0,
    created_by           CHAR(36)      NULL,
    updated_by           CHAR(36)      NULL,
    created_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_issue_parent (parent_issue_id),
    UNIQUE KEY uk_issue_display_key (display_key),
    KEY idx_issue_project_rd (project_id, rd_number),
    CONSTRAINT fk_issue_project  FOREIGN KEY (project_id)      REFERENCES project(id),
    CONSTRAINT fk_issue_release  FOREIGN KEY (release_id)      REFERENCES `release`(id),
    CONSTRAINT fk_issue_parent   FOREIGN KEY (parent_issue_id) REFERENCES rd_issue(id),
    CONSTRAINT fk_issue_type     FOREIGN KEY (issue_type_id)   REFERENCES issue_type(id),
    CONSTRAINT fk_issue_priority FOREIGN KEY (priority_id)     REFERENCES priority(id),
    CONSTRAINT fk_issue_status   FOREIGN KEY (status_id)       REFERENCES issue_status(id),
    CONSTRAINT fk_issue_reporter FOREIGN KEY (reported_by)     REFERENCES employee(id),
    CONSTRAINT fk_issue_assignee FOREIGN KEY (assigned_to)     REFERENCES employee(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Global RD custom field definitions (Admin-managed; seeded defaults included)
CREATE TABLE issue_field_definition (
    id              CHAR(36)     NOT NULL PRIMARY KEY,
    field_key       VARCHAR(80)  NOT NULL,
    label           VARCHAR(120) NOT NULL,
    data_type       VARCHAR(20)  NOT NULL,
    max_length      INT          NULL,
    required        TINYINT(1)   NOT NULL DEFAULT 0,
    active          TINYINT(1)   NOT NULL DEFAULT 1,
    system_field    TINYINT(1)   NOT NULL DEFAULT 0,
    section_code    VARCHAR(40)  NULL,
    display_order   INT          NOT NULL DEFAULT 0,
    options_json    TEXT         NULL,
    help_text       VARCHAR(255) NULL,
    created_by      CHAR(36)     NULL,
    updated_by      CHAR(36)     NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_issue_field_key (field_key),
    KEY idx_issue_field_order (active, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE issue_field_value (
    id                   CHAR(36)      NOT NULL PRIMARY KEY,
    issue_id             CHAR(36)      NOT NULL,
    field_definition_id  CHAR(36)      NOT NULL,
    value_text           TEXT          NULL,
    value_number         DECIMAL(14,2) NULL,
    value_date           DATE          NULL,
    value_bool           TINYINT(1)    NULL,
    created_by           CHAR(36)      NULL,
    updated_by           CHAR(36)      NULL,
    created_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_issue_field_value (issue_id, field_definition_id),
    CONSTRAINT fk_ifv_issue FOREIGN KEY (issue_id) REFERENCES rd_issue(id) ON DELETE CASCADE,
    CONSTRAINT fk_ifv_def   FOREIGN KEY (field_definition_id) REFERENCES issue_field_definition(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE task (
    id          CHAR(36)     NOT NULL PRIMARY KEY,
    issue_id    CHAR(36)     NOT NULL,
    title       VARCHAR(255) NOT NULL,
    description TEXT         NULL,
    assigned_to CHAR(36)     NULL,
    status_id   CHAR(36)     NOT NULL,
    version     BIGINT       NOT NULL DEFAULT 0,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_task_issue    FOREIGN KEY (issue_id)    REFERENCES rd_issue(id),
    CONSTRAINT fk_task_assignee FOREIGN KEY (assigned_to) REFERENCES employee(id),
    CONSTRAINT fk_task_status   FOREIGN KEY (status_id)   REFERENCES issue_status(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE allocation (
    id              CHAR(36)    NOT NULL PRIMARY KEY,
    employee_id     CHAR(36)    NOT NULL,
    issue_id        CHAR(36)    NOT NULL,
    role_on_project VARCHAR(50) NULL,
    percentage      INT         NOT NULL,
    from_date       DATE        NOT NULL,
    to_date         DATE        NULL,
    billable        TINYINT(1)  NOT NULL DEFAULT 1,
    deleted         TINYINT(1)  NOT NULL DEFAULT 0,
    version         BIGINT      NOT NULL DEFAULT 0,
    created_by      CHAR(36)    NULL,
    updated_by      CHAR(36)    NULL,
    created_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_alloc_employee FOREIGN KEY (employee_id) REFERENCES employee(id),
    CONSTRAINT fk_alloc_issue    FOREIGN KEY (issue_id)    REFERENCES rd_issue(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE time_log (
    id          CHAR(36)     NOT NULL PRIMARY KEY,
    employee_id CHAR(36)     NOT NULL,
    task_id     CHAR(36)     NOT NULL,
    log_date    DATE         NOT NULL,
    hours       DECIMAL(5,2) NOT NULL,
    notes       TEXT         NULL,
    created_by  CHAR(36)     NULL,
    updated_by  CHAR(36)     NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_tl_employee FOREIGN KEY (employee_id) REFERENCES employee(id),
    CONSTRAINT fk_tl_task     FOREIGN KEY (task_id)     REFERENCES task(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Admin / notifications / auth tokens
-- -----------------------------------------------------------------------------

CREATE TABLE holiday_calendar (
    id           CHAR(36)     NOT NULL PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    holiday_date DATE         NOT NULL,
    country_id   CHAR(36)     NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_holiday_country FOREIGN KEY (country_id) REFERENCES country(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE workflow_rule (
    id             CHAR(36)  NOT NULL PRIMARY KEY,
    issue_type_id  CHAR(36)  NULL,
    from_status_id CHAR(36)  NULL,
    to_status_id   CHAR(36)  NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_wr_type FOREIGN KEY (issue_type_id)  REFERENCES issue_type(id),
    CONSTRAINT fk_wr_from FOREIGN KEY (from_status_id) REFERENCES issue_status(id),
    CONSTRAINT fk_wr_to   FOREIGN KEY (to_status_id)   REFERENCES issue_status(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notification_template (
    id            CHAR(36)     NOT NULL PRIMARY KEY,
    code          VARCHAR(50)  NOT NULL UNIQUE,
    subject       VARCHAR(200) NOT NULL,
    body_template TEXT         NOT NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notification (
    id          CHAR(36)     NOT NULL PRIMARY KEY,
    employee_id CHAR(36)     NOT NULL,
    title       VARCHAR(200) NOT NULL,
    body        TEXT         NULL,
    type        VARCHAR(50)  NULL,
    read_flag   TINYINT(1)   NOT NULL DEFAULT 0,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notif_employee FOREIGN KEY (employee_id) REFERENCES employee(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE system_settings (
    id            CHAR(36)     NOT NULL PRIMARY KEY,
    setting_key   VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT         NULL,
    updated_by    CHAR(36)     NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ss_employee FOREIGN KEY (updated_by) REFERENCES employee(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_tool_catalog (
    id                   CHAR(36)     NOT NULL PRIMARY KEY,
    tool_key             VARCHAR(100) NOT NULL UNIQUE,
    display_name         VARCHAR(150) NOT NULL,
    description          TEXT         NULL,
    required_permission  VARCHAR(80)  NULL,
    sort_order           INT          NOT NULL DEFAULT 0,
    updated_by           CHAR(36)     NULL,
    created_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ai_tool_employee FOREIGN KEY (updated_by) REFERENCES employee(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_log (
    id          CHAR(36)    NOT NULL PRIMARY KEY,
    employee_id CHAR(36)    NULL,
    action      VARCHAR(30) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id   CHAR(36)    NULL,
    details     TEXT        NULL,
    ip_address  VARCHAR(45) NULL,
    created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_employee FOREIGN KEY (employee_id) REFERENCES employee(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE refresh_token (
    id          CHAR(36)    NOT NULL PRIMARY KEY,
    employee_id CHAR(36)    NOT NULL,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,
    expires_at  TIMESTAMP   NOT NULL,
    revoked     TINYINT(1)  NOT NULL DEFAULT 0,
    created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rt_employee FOREIGN KEY (employee_id) REFERENCES employee(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE password_reset_token (
    id          CHAR(36)    NOT NULL PRIMARY KEY,
    employee_id CHAR(36)    NOT NULL,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,
    expires_at  TIMESTAMP   NOT NULL,
    used        TINYINT(1)  NOT NULL DEFAULT 0,
    created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_prt_employee FOREIGN KEY (employee_id) REFERENCES employee(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Done.

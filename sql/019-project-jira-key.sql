-- Apply when Liquibase is disabled (ddl-auto: validate).
ALTER TABLE project
    ADD COLUMN jira_project_key VARCHAR(50) NULL AFTER product;

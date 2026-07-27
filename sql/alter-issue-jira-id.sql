-- Add permanent JIRA ID on RD issues (nullable).
-- Run once on existing databases that already have rd_issue.

ALTER TABLE rd_issue
    ADD COLUMN jira_id VARCHAR(80) NULL AFTER title;

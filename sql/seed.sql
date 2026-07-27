-- =============================================================================
-- DFN-PlanX — Seed data
-- Run AFTER build.sql (build drops/recreates empty tables; this file inserts only).
--
-- Usage:
--   mysql -u root -p < build.sql
--   mysql -u root -p < seed.sql
--
-- Seeds reference data, RBAC, and delivery lookups only.
-- Management roster, team employees, projects, and RD issues are loaded via Excel import.
--
-- Bootstrap login (password Admin@12345):
--   admin@dfnpm.local — Super Admin
--
-- System roles:
--   1 Super Admin — all privileges
--   2 Admin       — no Admin/Users/Reference; no delete
--   3 CXO         — view all except Admin menu
--   4 VP          — view within VP org except Admin menu
--   5 Manager     — Senior Manager or Manager; reports to VP
--   6 Employee    — reports to Manager; view own data only
--
-- Org hierarchy: CXO → VP → Manager / Senior Manager → Employee
-- =============================================================================

CREATE DATABASE IF NOT EXISTS dfn_pm
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE dfn_pm;

-- Geography
INSERT INTO region (id, name, code) VALUES
('a0000001-0000-0000-0000-000000000001', 'Asia Pacific', 'APAC');

INSERT INTO country (id, region_id, name, code) VALUES
('a1000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'Sri Lanka', 'LK'),
('a1000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000001', 'India', 'IN'),
('a1000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000001', 'Saudi Arabia', 'KSA'),
('a1000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000001', 'International', 'INT');

-- Org reference data
INSERT INTO department (id, name) VALUES
('22222222-2222-2222-2222-222222222201', 'Engineering');

INSERT INTO stream (id, name, department_id) VALUES
('44444444-4444-4444-4444-444444444401', 'Software Engineering', '22222222-2222-2222-2222-222222222201'),
('44444444-4444-4444-4444-444444444402', 'Platform',             '22222222-2222-2222-2222-222222222201'),
('44444444-4444-4444-4444-444444444403', 'Engineering',          '22222222-2222-2222-2222-222222222201'),
('44444444-4444-4444-4444-444444444404', 'APAC Engineering',     '22222222-2222-2222-2222-222222222201'),
('44444444-4444-4444-4444-444444444405', 'EMEA Engineering',     '22222222-2222-2222-2222-222222222201'),
('44444444-4444-4444-4444-444444444406', 'FinCore Squad',        '22222222-2222-2222-2222-222222222201'),
('44444444-4444-4444-4444-444444444407', 'Health Squad',         '22222222-2222-2222-2222-222222222201'),
('44444444-4444-4444-4444-444444444408', 'Data Squad',           '22222222-2222-2222-2222-222222222201');

INSERT INTO work_type (id, name) VALUES
('55555555-5555-5555-5555-555555555501', 'GBL'),
('55555555-5555-5555-5555-555555555502', 'NTP'),
('55555555-5555-5555-5555-555555555503', 'CLIENT PRODUCTS');

INSERT INTO designation (id, name, code, department_id, stream_id, is_management) VALUES
('33333333-3333-3333-3333-333333333301', 'Software Engineer',        'SE',  '22222222-2222-2222-2222-222222222201', '44444444-4444-4444-4444-444444444401', 0),
('33333333-3333-3333-3333-333333333302', 'VP Engineering',           'VP',  '22222222-2222-2222-2222-222222222201', '44444444-4444-4444-4444-444444444401', 1),
('33333333-3333-3333-3333-333333333303', 'Tech Lead',                'TL',  '22222222-2222-2222-2222-222222222201', '44444444-4444-4444-4444-444444444401', 1),
('33333333-3333-3333-3333-333333333305', 'Engineering Manager',      'EM',  '22222222-2222-2222-2222-222222222201', '44444444-4444-4444-4444-444444444401', 1),
('33333333-3333-3333-3333-333333333304', 'Chief Technology Officer', 'CTO', '22222222-2222-2222-2222-222222222201', '44444444-4444-4444-4444-444444444401', 1);

-- App reporting line: CXO → VP → Manager (Senior Manager or Manager) → Employee
INSERT INTO org_level (id, code, name, level_order, reports_to_org_level_id) VALUES
('0c000001-0000-0000-0000-000000000001', 'CXO',      'CXO',      1, NULL),
('0c000001-0000-0000-0000-000000000002', 'VP',       'VP',       2, '0c000001-0000-0000-0000-000000000001'),
('0c000001-0000-0000-0000-000000000003', 'MANAGER',  'Manager / Senior Manager',  3, '0c000001-0000-0000-0000-000000000002'),
('0c000001-0000-0000-0000-000000000004', 'EMPLOYEE', 'Employee', 4, '0c000001-0000-0000-0000-000000000003');

-- System roles (IDs 1–6): Super Admin, Admin, CXO, VP, Manager, Employee
INSERT INTO role (id, name, code, org_level_id) VALUES
('11111111-1111-1111-1111-111111111101', 'Super Admin', 'SUPER_ADMIN', NULL),
('11111111-1111-1111-1111-111111111102', 'Admin',       'ADMIN',       NULL),
('11111111-1111-1111-1111-111111111103', 'CXO',         'CXO',         '0c000001-0000-0000-0000-000000000001'),
('11111111-1111-1111-1111-111111111104', 'VP',          'VP',          '0c000001-0000-0000-0000-000000000002'),
('11111111-1111-1111-1111-111111111105', 'Manager / Senior Manager', 'MANAGER', '0c000001-0000-0000-0000-000000000003'),
('11111111-1111-1111-1111-111111111106', 'Employee',    'EMPLOYEE',    '0c000001-0000-0000-0000-000000000004');

-- Permission catalogue mirrors nav menus / functions:
--   Dashboard | Planning (Projects, Main Backlog, Resource utilization)
--   Organization (Org structure) | Admin (Organisation, Management, Employee, Time, Users, Admin)
--   plus Releases, Excel import, Reference data (incl. Skills)
INSERT INTO permission (id, name, code, module, action) VALUES
('b1000001-0000-0000-0000-000000000001', 'User accounts — View',              'USERS_VIEW',          'USERS',         'VIEW'),
('b1000001-0000-0000-0000-000000000002', 'User accounts — Create',            'USERS_CREATE',        'USERS',         'CREATE'),
('b1000001-0000-0000-0000-000000000003', 'User accounts — Update',            'USERS_UPDATE',        'USERS',         'UPDATE'),
('b1000001-0000-0000-0000-000000000004', 'User accounts — Delete',            'USERS_DELETE',        'USERS',         'DELETE'),
('b1000001-0000-0000-0000-000000000005', 'Projects — View',                   'PROJECTS_VIEW',       'PROJECTS',      'VIEW'),
('b1000001-0000-0000-0000-000000000006', 'Projects — Create',                 'PROJECTS_CREATE',     'PROJECTS',      'CREATE'),
('b1000001-0000-0000-0000-000000000007', 'Projects — Update',                 'PROJECTS_UPDATE',     'PROJECTS',      'UPDATE'),
('b1000001-0000-0000-0000-000000000008', 'Projects — Delete',                 'PROJECTS_DELETE',     'PROJECTS',      'DELETE'),
('b1000001-0000-0000-0000-000000000009', 'Main Backlog — View',               'ISSUES_VIEW',         'ISSUES',        'VIEW'),
('b1000001-0000-0000-0000-000000000010', 'Main Backlog — Create',             'ISSUES_CREATE',       'ISSUES',        'CREATE'),
('b1000001-0000-0000-0000-000000000011', 'Main Backlog — Update',             'ISSUES_UPDATE',       'ISSUES',        'UPDATE'),
('b1000001-0000-0000-0000-000000000012', 'Main Backlog — Delete',             'ISSUES_DELETE',       'ISSUES',        'DELETE'),
('b1000001-0000-0000-0000-000000000013', 'Resource utilization — View',       'ALLOCATIONS_VIEW',    'ALLOCATIONS',   'VIEW'),
('b1000001-0000-0000-0000-000000000014', 'Resource utilization — Create',     'ALLOCATIONS_CREATE',  'ALLOCATIONS',   'CREATE'),
('b1000001-0000-0000-0000-000000000015', 'Resource utilization — Update',     'ALLOCATIONS_UPDATE',  'ALLOCATIONS',   'UPDATE'),
('b1000001-0000-0000-0000-000000000016', 'Resource utilization — Delete',     'ALLOCATIONS_DELETE',  'ALLOCATIONS',   'DELETE'),
('b1000001-0000-0000-0000-000000000017', 'Dashboard — View',                  'REPORTS_VIEW',        'REPORTS',       'VIEW'),
('b1000001-0000-0000-0000-000000000021', 'Organisation — View',               'ORGANISATIONS_VIEW',  'ORGANISATIONS', 'VIEW'),
('b1000001-0000-0000-0000-000000000022', 'Organisation — Create',             'ORGANISATIONS_CREATE','ORGANISATIONS', 'CREATE'),
('b1000001-0000-0000-0000-000000000023', 'Organisation — Update',             'ORGANISATIONS_UPDATE','ORGANISATIONS', 'UPDATE'),
('b1000001-0000-0000-0000-000000000024', 'Organisation — Delete',             'ORGANISATIONS_DELETE','ORGANISATIONS', 'DELETE'),
('b1000001-0000-0000-0000-000000000025', 'Management and employees — View',   'TEAM_VIEW',           'TEAM',          'VIEW'),
('b1000001-0000-0000-0000-000000000026', 'Management and employees — Create', 'TEAM_CREATE',         'TEAM',          'CREATE'),
('b1000001-0000-0000-0000-000000000027', 'Management and employees — Update', 'TEAM_UPDATE',         'TEAM',          'UPDATE'),
('b1000001-0000-0000-0000-000000000028', 'Management and employees — Delete', 'TEAM_DELETE',         'TEAM',          'DELETE'),
('b1000001-0000-0000-0000-000000000029', 'Admin (system) — View',             'ADMIN_VIEW',          'ADMIN',         'VIEW'),
('b1000001-0000-0000-0000-000000000030', 'Admin (system) — Create',           'ADMIN_CREATE',        'ADMIN',         'CREATE'),
('b1000001-0000-0000-0000-000000000031', 'Admin (system) — Update',           'ADMIN_UPDATE',        'ADMIN',         'UPDATE'),
('b1000001-0000-0000-0000-000000000032', 'Admin (system) — Delete',           'ADMIN_DELETE',        'ADMIN',         'DELETE'),
('b1000001-0000-0000-0000-000000000033', 'Reference data — View',             'REFERENCE_VIEW',      'REFERENCE',     'VIEW'),
('b1000001-0000-0000-0000-000000000034', 'Reference data — Create',           'REFERENCE_CREATE',    'REFERENCE',     'CREATE'),
('b1000001-0000-0000-0000-000000000035', 'Reference data — Update',           'REFERENCE_UPDATE',    'REFERENCE',     'UPDATE'),
('b1000001-0000-0000-0000-000000000036', 'Reference data — Delete',           'REFERENCE_DELETE',    'REFERENCE',     'DELETE'),
('b1000001-0000-0000-0000-000000000037', 'Excel import — View',               'IMPORT_VIEW',         'IMPORT',        'VIEW'),
('b1000001-0000-0000-0000-000000000038', 'Excel import — Run',                'IMPORT_CREATE',       'IMPORT',        'CREATE'),
('b1000001-0000-0000-0000-000000000039', 'Releases — View',                   'RELEASES_VIEW',       'RELEASES',      'VIEW'),
('b1000001-0000-0000-0000-000000000040', 'Releases — Create',                 'RELEASES_CREATE',     'RELEASES',      'CREATE'),
('b1000001-0000-0000-0000-000000000041', 'Org structure — View',              'ORG_STRUCTURE_VIEW',  'ORG_STRUCTURE', 'VIEW'),
('b1000001-0000-0000-0000-000000000042', 'PMO pages — View',                  'PMO_VIEW',            'PMO',           'VIEW'),
('b1000001-0000-0000-0000-000000000043', 'PMO pages — Create',                'PMO_CREATE',          'PMO',           'CREATE'),
('b1000001-0000-0000-0000-000000000044', 'PMO pages — Update',                'PMO_UPDATE',          'PMO',           'UPDATE'),
('b1000001-0000-0000-0000-000000000045', 'PMO pages — Delete',                'PMO_DELETE',          'PMO',           'DELETE'),
('b1000001-0000-0000-0000-000000000046', 'AI Assistant — View',               'AI_ASSISTANT_VIEW',   'AI',            'VIEW');

-- Super Admin — all privileges
INSERT INTO role_permission (role_id, permission_id)
SELECT '11111111-1111-1111-1111-111111111101', id FROM permission;

-- Admin — full access except Admin menu and all delete actions
INSERT INTO role_permission (role_id, permission_id)
SELECT '11111111-1111-1111-1111-111111111102', id FROM permission
WHERE module NOT IN ('ADMIN', 'USERS', 'REFERENCE')
  AND action <> 'DELETE';

-- CXO / VP / Manager — view non-admin areas + full allocation management
-- (org / project scoping enforced in application)
INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
CROSS JOIN permission p
WHERE r.code IN ('CXO', 'VP', 'MANAGER')
  AND p.action = 'VIEW'
  AND p.module NOT IN ('ADMIN', 'USERS', 'REFERENCE');

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
CROSS JOIN permission p
WHERE r.code IN ('CXO', 'VP', 'MANAGER')
  AND p.code IN (
    'ALLOCATIONS_CREATE',
    'ALLOCATIONS_UPDATE',
    'ALLOCATIONS_DELETE',
    'PMO_UPDATE'
  );

-- Employee — view own work areas only (row-level scoping enforced in application)
INSERT INTO role_permission (role_id, permission_id)
SELECT '11111111-1111-1111-1111-111111111106', id FROM permission
WHERE code IN (
  'PROJECTS_VIEW',
  'ISSUES_VIEW',
  'ALLOCATIONS_VIEW',
  'REPORTS_VIEW',
  'RELEASES_VIEW',
  'IMPORT_VIEW'
);

-- Bootstrap super-admin only (no management roster / demo employees)
INSERT INTO employee (
    id, email, first_name, last_name, department_id, designation_id, stream_id,
    work_type_id, country_id, product, status, bench_status, version
) VALUES (
    '77777777-7777-7777-7777-777777777701',
    'admin@dfnpm.local',
    'System',
    'Admin',
    '22222222-2222-2222-2222-222222222201',
    '33333333-3333-3333-3333-333333333304',
    '44444444-4444-4444-4444-444444444402',
    '55555555-5555-5555-5555-555555555501',
    'a1000001-0000-0000-0000-000000000001',
    'Core Banking Suite',
    'ACTIVE',
    'ASSIGNED',
    0
);

INSERT INTO employee_role (employee_id, role_id) VALUES
('77777777-7777-7777-7777-777777777701', '11111111-1111-1111-1111-111111111101');

-- Auth (bcrypt cost 12) — Admin@12345
INSERT INTO user_auth (id, employee_id, password_hash, password_changed_at, failed_attempts, locked_until, active) VALUES
('d1000001-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777701', '$2a$12$hUzy.muPEInp6bzPGXDxPO2D7J7lP4fi90rAHKuFSXK5O1HdmoeUa', CURRENT_TIMESTAMP, 0, NULL, TRUE);

-- Delivery lookups (required for RD/issue workflows; no sample issues)
INSERT INTO priority (id, label, level, sla_response_hrs, sla_resolve_hrs, colour) VALUES
('44444444-4444-4444-4444-444444444401', 'Critical', 1,  1,   4,   '#E24B4A'),
('44444444-4444-4444-4444-444444444402', 'High',     2,  4,   24,  '#BA7517'),
('44444444-4444-4444-4444-444444444403', 'Medium',   3,  8,   72,  '#185FA5'),
('44444444-4444-4444-4444-444444444404', 'Low',      4,  24,  240, '#888780');

INSERT INTO issue_status (id, name, sequence, terminal, colour) VALUES
('55555555-5555-5555-5555-555555555501', 'Requirements Initiated',              1,  FALSE, '#888780'),
('55555555-5555-5555-5555-555555555502', 'Initial Requirement Gathering',     2,  FALSE, '#8B909A'),
('55555555-5555-5555-5555-555555555503', 'Pending BP Effort',                 3,  FALSE, '#9AA0AB'),
('55555555-5555-5555-5555-555555555504', 'Pending BP Effort Approval',        4,  FALSE, '#A8AEB8'),
('55555555-5555-5555-5555-555555555505', 'Ballpark Accepted',                 5,  FALSE, '#B6BCC6'),
('55555555-5555-5555-5555-555555555506', 'RD Drafting',                       6,  FALSE, '#6B7C93'),
('55555555-5555-5555-5555-555555555507', 'Pending RD Approval',               7,  FALSE, '#5E7190'),
('55555555-5555-5555-5555-555555555508', 'RD Signed Off',                     8,  FALSE, '#51668D'),
('55555555-5555-5555-5555-555555555509', 'Pending Final Effort',              9,  FALSE, '#445B8A'),
('55555555-5555-5555-5555-555555555510', 'Pending Quotation Preparation',    10,  FALSE, '#3D5F96'),
('55555555-5555-5555-5555-555555555511', 'Pending Quotation Approval',       11,  FALSE, '#3663A2'),
('55555555-5555-5555-5555-555555555512', 'Quotation Approved / Dev not started', 12, FALSE, '#2F67AE'),
('55555555-5555-5555-5555-555555555513', 'Dev in Progress',                  13,  FALSE, '#185FA5'),
('55555555-5555-5555-5555-555555555514', 'Dev Completed',                    14,  FALSE, '#2470B8'),
('55555555-5555-5555-5555-555555555515', 'SIT Testing',                      15,  FALSE, '#3F6FD0'),
('55555555-5555-5555-5555-555555555516', 'UAT Testing',                      16,  FALSE, '#534AB7'),
('55555555-5555-5555-5555-555555555517', 'UAT Signed Off / Pending Production', 17, FALSE, '#2F8F7A'),
('55555555-5555-5555-5555-555555555518', 'In Production',                    18,  FALSE, '#1F9D6C'),
('55555555-5555-5555-5555-555555555519', 'Completed',                        19,  TRUE,  '#0F6E56'),
('55555555-5555-5555-5555-555555555520', 'Cancelled',                        20,  TRUE,  '#A32D2D'),
('55555555-5555-5555-5555-555555555521', 'On Hold',                          21,  TRUE,  '#854F0B');

INSERT INTO issue_type (id, name, workflow_code, description) VALUES
('66666666-6666-6666-6666-666666666605', 'Epic',           'EPIC',    'A large body of work that groups stories and tasks'),
('66666666-6666-6666-6666-666666666602', 'Stories',        'STORY',   'A user-facing feature or product requirement'),
('66666666-6666-6666-6666-666666666604', 'Task',           'TASK',    'An internal technical or operational task'),
('66666666-6666-6666-6666-666666666603', 'Change Request', 'CHANGE',  'Modification to existing agreed scope'),
('66666666-6666-6666-6666-666666666601', 'Bugs',           'BUG',     'A defect or unexpected behaviour');

INSERT INTO notification_template (id, code, subject, body_template) VALUES
('03000001-0000-0000-0000-000000000002', 'ALLOCATION_NEW', 'New project allocation', 'You have been allocated {{percentage}}% to {{projectName}}.'),
('03000001-0000-0000-0000-000000000003', 'PASSWORD_RESET', 'DFN-PlanX password reset', 'Use this link to reset your password: {{resetUrl}}');

INSERT INTO system_settings (id, setting_key, setting_value, updated_by) VALUES
('04000001-0000-0000-0000-000000000001', 'app.name',                       'DFN-PlanX', '77777777-7777-7777-7777-777777777701'),
('04000001-0000-0000-0000-000000000003', 'allocation.bench.threshold_pct', '20',     '77777777-7777-7777-7777-777777777701'),
('04000001-0000-0000-0000-000000000010', 'ai.enabled',                     'true',  '77777777-7777-7777-7777-777777777701'),
('04000001-0000-0000-0000-000000000011', 'ai.system_instructions',         '',      '77777777-7777-7777-7777-777777777701'),
('04000001-0000-0000-0000-000000000012', 'ai.max_tools_per_question',      '4',     '77777777-7777-7777-7777-777777777701'),
('04000001-0000-0000-0000-000000000013', 'ai.rate_limit_per_hour',         '30',    '77777777-7777-7777-7777-777777777701'),
('04000001-0000-0000-0000-000000000014', 'ai.model_profile',               'local-ollama', '77777777-7777-7777-7777-777777777701'),
('04000001-0000-0000-0000-000000000015', 'ai.allowed_roles',               '',      '77777777-7777-7777-7777-777777777701');

-- Default Active AI tools (Phase 1 seeded set)
INSERT INTO ai_tool_catalog (id, tool_key, display_name, description, required_permission, sort_order, updated_by) VALUES
('05000001-0000-0000-0000-000000000001', 'dashboard.summary', 'Dashboard summary',
 'Get high-level dashboard summary metrics for the current user''s scoped projects (counts, status rollups).',
 'REPORTS_VIEW', 10, '77777777-7777-7777-7777-777777777701'),
('05000001-0000-0000-0000-000000000002', 'dashboard.overview', 'Dashboard overview',
 'Get detailed dashboard overview including project breakdowns and resource highlights for the current user''s scope.',
 'REPORTS_VIEW', 20, '77777777-7777-7777-7777-777777777701'),
('05000001-0000-0000-0000-000000000003', 'capacity.utilisation', 'Capacity utilisation',
 'Get capacity utilisation for engineers over a week horizon. Use for over-allocation and who is busy next N weeks. Optional: weeks (1-52, default 12).',
 'ALLOCATIONS_VIEW', 30, '77777777-7777-7777-7777-777777777701'),
('05000001-0000-0000-0000-000000000004', 'issues.statusCounts', 'Issue status counts',
 'Get issue status counts, optionally filtered by project, unreleased-only, priority, or type.',
 'ISSUES_VIEW', 40, '77777777-7777-7777-7777-777777777701'),
('05000001-0000-0000-0000-000000000005', 'issues.crMatrix', 'CR status matrix',
 'Get Change Request (CR) status matrix, optionally for one project.',
 'ISSUES_VIEW', 50, '77777777-7777-7777-7777-777777777701');

-- Seeded global RD custom fields (excludes fixed columns: jira_id, title, description, priority, status, capitalization).
-- IDs are stable for fresh installs via seed.sql / bootstrap runner.

INSERT INTO issue_field_definition
(id, field_key, label, data_type, max_length, required, active, system_field, section_code, display_order, options_json)
VALUES
('c1000001-0000-0000-0000-000000000001', 'sow', 'SOW', 'TEXT', 255, 0, 1, 1, 'GENERAL', 10, NULL),
('c1000001-0000-0000-0000-000000000002', 'covered_in_existing_resources', 'Covered in Existing Resources', 'DROPDOWN', NULL, 0, 1, 1, 'GENERAL', 20, '["Yes","No"]'),
('c1000001-0000-0000-0000-000000000008', 'cr_type', 'CR Type', 'DROPDOWN', NULL, 0, 1, 1, 'GENERAL', 25, '["CR","AMC"]'),
('c1000001-0000-0000-0000-000000000003', 'major_cr', 'Major CR', 'DROPDOWN', NULL, 0, 1, 1, 'GENERAL', 30, '["Yes","No"]'),
('c1000001-0000-0000-0000-000000000004', 'delivery_quarter', 'Delivery Quarter', 'DROPDOWN', NULL, 0, 1, 1, 'GENERAL', 40, '["Q1","Q2","Q3","Q4"]'),
('c1000001-0000-0000-0000-000000000005', 'delivery_year', 'Delivery Year', 'YEAR', NULL, 0, 1, 1, 'GENERAL', 50, NULL),
('c1000001-0000-0000-0000-000000000006', 'percentage_completion', 'Percentage Completion', 'TEXT', 50, 0, 1, 1, 'GENERAL', 60, NULL),

('c1000001-0000-0000-0000-000000000010', 'requirement_initiated_date', 'Requirement Initiated Date', 'DATE', NULL, 0, 1, 1, 'DATES', 110, NULL),
('c1000001-0000-0000-0000-000000000011', 'brd_requested_date', 'BRD Requested Date', 'DATE', NULL, 0, 1, 1, 'DATES', 120, NULL),
('c1000001-0000-0000-0000-000000000012', 'brd_received_date', 'BRD Received Date', 'DATE', NULL, 0, 1, 1, 'DATES', 130, NULL),
('c1000001-0000-0000-0000-000000000013', 'ba_ballpark_effort', 'BA Ballpark Effort', 'NUMBER', NULL, 0, 1, 1, 'DATES', 140, NULL),
('c1000001-0000-0000-0000-000000000014', 'bp_effort_eta', 'BP Effort ETA', 'DATE', NULL, 0, 1, 1, 'DATES', 150, NULL),
('c1000001-0000-0000-0000-000000000015', 'bp_effort', 'BP Effort', 'NUMBER', NULL, 0, 1, 1, 'DATES', 160, NULL),
('c1000001-0000-0000-0000-000000000016', 'bp_effort_accepted_date', 'BP Effort Accepted Date', 'DATE', NULL, 0, 1, 1, 'DATES', 170, NULL),
('c1000001-0000-0000-0000-000000000017', 'total_effort_eta', 'Total Effort ETA', 'DATE', NULL, 0, 1, 1, 'DATES', 180, NULL),
('c1000001-0000-0000-0000-000000000018', 'rd_start_date', 'RD Start Date', 'DATE', NULL, 0, 1, 1, 'DATES', 190, NULL),
('c1000001-0000-0000-0000-000000000019', 'rd_delivery_eta', 'RD Delivery ETA', 'DATE', NULL, 0, 1, 1, 'DATES', 200, NULL),
('c1000001-0000-0000-0000-000000000020', 'rd_sign_off_date', 'RD Sign Off Date', 'DATE', NULL, 0, 1, 1, 'DATES', 210, NULL),

('c1000001-0000-0000-0000-000000000030', 'costing_done', 'Costing Done?', 'DROPDOWN', NULL, 0, 1, 1, 'FINANCIALS', 310, '["Yes","No","Pending","Onhold"]'),
('c1000001-0000-0000-0000-000000000031', 'quote_done', 'Quote Done?', 'DROPDOWN', NULL, 0, 1, 1, 'FINANCIALS', 320, '["Yes","No"]'),
('c1000001-0000-0000-0000-000000000032', 'quotation', 'Quotation', 'NUMBER', NULL, 0, 1, 1, 'FINANCIALS', 330, NULL),
('c1000001-0000-0000-0000-000000000033', 'quotation_shared_date', 'Quotation Shared Date', 'DATE', NULL, 0, 1, 1, 'FINANCIALS', 340, NULL),
('c1000001-0000-0000-0000-000000000034', 'quotation_approved_date', 'Quotation Approved Date', 'DATE', NULL, 0, 1, 1, 'FINANCIALS', 350, NULL),
('c1000001-0000-0000-0000-000000000035', 'deal_desk_approval_status', 'Deal Desk Approval Status', 'DROPDOWN', NULL, 0, 1, 1, 'FINANCIALS', 360, '["Approved","Not Approved","Reject"]'),
('c1000001-0000-0000-0000-000000000036', 'payment_status', 'Payment Status', 'DROPDOWN', NULL, 0, 1, 1, 'FINANCIALS', 370, '["Open","Completed"]'),

('c1000001-0000-0000-0000-000000000040', 'md_planned', 'Man-days Planned', 'NUMBER', NULL, 0, 1, 1, 'MAN_DAYS', 410, NULL),
('c1000001-0000-0000-0000-000000000041', 'md_additional', 'Man-days Additional', 'NUMBER', NULL, 0, 1, 1, 'MAN_DAYS', 420, NULL),
('c1000001-0000-0000-0000-000000000042', 'md_total', 'Man-days Total', 'NUMBER', NULL, 0, 1, 1, 'MAN_DAYS', 430, NULL),
('c1000001-0000-0000-0000-000000000043', 'md_actually_utilized', 'Man-days Actually Utilized', 'NUMBER', NULL, 0, 1, 1, 'MAN_DAYS', 440, NULL),
('c1000001-0000-0000-0000-000000000044', 'md_remaining', 'Man-days Remaining', 'NUMBER', NULL, 0, 1, 1, 'MAN_DAYS', 450, NULL),

('c1000001-0000-0000-0000-000000000050', 'dev_start_date', 'Dev Start Date', 'DATE', NULL, 0, 1, 1, 'MILESTONES', 510, NULL),
('c1000001-0000-0000-0000-000000000051', 'dev_end_date', 'Dev End Date', 'DATE', NULL, 0, 1, 1, 'MILESTONES', 520, NULL),
('c1000001-0000-0000-0000-000000000052', 'sit_start_date', 'SIT Start Date', 'DATE', NULL, 0, 1, 1, 'MILESTONES', 530, NULL),
('c1000001-0000-0000-0000-000000000053', 'sit_end_date', 'SIT End Date', 'DATE', NULL, 0, 1, 1, 'MILESTONES', 540, NULL),
('c1000001-0000-0000-0000-000000000054', 'uat_start_date', 'UAT Start Date', 'DATE', NULL, 0, 1, 1, 'MILESTONES', 550, NULL),
('c1000001-0000-0000-0000-000000000055', 'uat_end_date', 'UAT End Date', 'DATE', NULL, 0, 1, 1, 'MILESTONES', 560, NULL),
('c1000001-0000-0000-0000-000000000056', 'prod_date', 'Prod Date', 'DATE', NULL, 0, 1, 1, 'MILESTONES', 570, NULL),

('c1000001-0000-0000-0000-000000000060', 'risk_description', 'Risk Description', 'TEXT', 2000, 0, 1, 1, 'RISK', 610, NULL),
('c1000001-0000-0000-0000-000000000061', 'risk_created_date', 'Risk Created Date', 'DATE', NULL, 0, 1, 1, 'RISK', 620, NULL),
('c1000001-0000-0000-0000-000000000062', 'risk_owner', 'Risk Owner', 'TEXT', 120, 0, 1, 1, 'RISK', 630, NULL),
('c1000001-0000-0000-0000-000000000063', 'risk_status', 'Risk Status', 'DROPDOWN', NULL, 0, 1, 1, 'RISK', 640, '["Open","Closed","Hold","Rejected"]'),
('c1000001-0000-0000-0000-000000000064', 'risk_impact', 'Risk Impact', 'DROPDOWN', NULL, 0, 1, 1, 'RISK', 650, '["Low","Mid","High"]'),
('c1000001-0000-0000-0000-000000000065', 'risk_closed_date', 'Risk Closed Date', 'DATE', NULL, 0, 1, 1, 'RISK', 660, NULL),
('c1000001-0000-0000-0000-000000000066', 'risk_mitigation', 'Risk Mitigation', 'TEXT', 2000, 0, 1, 1, 'RISK', 670, NULL),

('c1000001-0000-0000-0000-000000000070', 'notes', 'Notes', 'TEXT', 4000, 0, 1, 1, 'OTHER', 710, NULL);


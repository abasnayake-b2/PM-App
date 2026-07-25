-- Existing databases: add Management flag on designation
ALTER TABLE designation
  ADD COLUMN is_management TINYINT(1) NOT NULL DEFAULT 0 AFTER stream_id;

-- Seed-aligned defaults for common management titles (safe if names differ)
UPDATE designation SET is_management = 1
WHERE UPPER(COALESCE(code, '')) IN ('VP', 'EM', 'CTO', 'CXO', 'TL', 'MGR', 'SEM')
   OR LOWER(name) LIKE '%manager%'
   OR LOWER(name) LIKE '%vp %'
   OR LOWER(name) LIKE 'vp %'
   OR LOWER(name) LIKE '%chief%'
   OR LOWER(name) LIKE '%director%';

-- ============================================================================
-- Module: Fixed independent services and Manifest-owned menu metadata.
-- ============================================================================

CREATE TABLE modules (
    id TEXT PRIMARY KEY CHECK (id IN ('monitor', 'insights', 'reports')),
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1))
);

INSERT INTO modules (id, enabled)
VALUES ('monitor', 1), ('insights', 1), ('reports', 1);

ALTER TABLE menus ADD COLUMN path TEXT;
ALTER TABLE menus ADD COLUMN icon TEXT;
ALTER TABLE menus ADD COLUMN module_id TEXT REFERENCES modules(id);
ALTER TABLE menus ADD COLUMN module_menu_code TEXT;
ALTER TABLE menus ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));

CREATE UNIQUE INDEX idx_menus_module_menu_code
    ON menus(module_id, module_menu_code)
    WHERE module_id IS NOT NULL
      AND module_menu_code IS NOT NULL
      AND is_active = 1
      AND deleted_at IS NULL;
CREATE INDEX idx_menus_module_active
    ON menus(module_id, is_active)
    WHERE module_id IS NOT NULL
      AND deleted_at IS NULL;

UPDATE menus SET module_id = 'monitor', is_active = 0 WHERE code LIKE 'monitor:%';
UPDATE menus SET module_id = 'insights', is_active = 0 WHERE code LIKE 'insights:%';
UPDATE menus SET module_id = 'reports', is_active = 0 WHERE code LIKE 'reports:%';

DROP INDEX idx_menus_name;
CREATE UNIQUE INDEX idx_menus_name
    ON menus(name)
    WHERE deleted_at IS NULL AND is_active = 1;

DROP VIEW role_with_menus;
DROP VIEW user_permissions;

CREATE VIEW user_permissions AS
SELECT DISTINCT
    u.id AS user_id,
    u.username,
    m.code AS menu_code,
    m.menu_type,
    r.code AS role_code,
    m.id AS menu_id,
    r.id AS role_id
FROM users u
INNER JOIN user_roles ur ON u.id = ur.user_id
INNER JOIN roles r ON ur.role_id = r.id AND r.status = 1 AND r.deleted_at IS NULL
INNER JOIN role_menus rm ON r.id = rm.role_id
INNER JOIN menus m ON rm.menu_id = m.id AND m.deleted_at IS NULL
WHERE u.deleted_at IS NULL
  AND u.status = 1
  AND m.is_active = 1
  AND m.code IS NOT NULL;

CREATE VIEW role_with_menus AS
SELECT
    r.id AS id,
    r.name,
    r.code,
    r.description,
    r.status,
    r.created_at,
    r.updated_at,
    r.deleted_at,
    r.is_system,
    COALESCE(
        (
            SELECT json_group_array(json_object('label', mo.name, 'value', mo.id))
            FROM (
                SELECT m.name, m.id
                FROM role_menus rm
                INNER JOIN menus m ON rm.menu_id = m.id
                    AND m.deleted_at IS NULL
                    AND m.is_active = 1
                WHERE rm.role_id = r.id
                ORDER BY m.id
            ) mo
        ),
        '[]'
    ) AS menus
FROM roles r
WHERE r.deleted_at IS NULL;

-- ============================================================================
-- Module: Initial seed data.
-- ============================================================================

INSERT INTO users (username, email, password_hash, real_name, status, is_system)
VALUES (
    'superadmin',
    'superadmin@example.com',
    '$argon2id$v=19$m=19456,t=2,p=1$i2SSaoqEMMwYzJQPXhVHfg$k1Y5bZ/k5SxEoEroG+UFzCW8aKzK1o/DWKKDU34FiPI',
    '超级管理员',
    1,
    1
)
ON CONFLICT DO NOTHING;

INSERT INTO roles (name, code, description, status, is_system, sort_order)
VALUES
    (
        '所有者',
        'owner',
        '内置所有者角色，拥有全部权限。',
        1,
        1,
        1
    ),
    (
        '管理员',
        'admin',
        '内置管理员角色，拥有日常管理权限。',
        1,
        1,
        2
    ),
    (
        '查看者',
        'viewer',
        '内置查看者角色，仅拥有只读权限。',
        1,
        1,
        3
    )
ON CONFLICT DO NOTHING;

INSERT INTO menus (parent_id, name, code, menu_type, sort_order, status, is_system, is_manual)
VALUES (
    0,
    '全部权限',
    '*',
    1,
    1,
    1,
    1,
    0
)
ON CONFLICT DO NOTHING;

INSERT INTO role_menus (role_id, menu_id, created_at)
SELECT r.id, m.id, CURRENT_TIMESTAMP
FROM roles r
CROSS JOIN menus m
WHERE r.code = 'owner'
  AND m.code = '*'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id, created_at)
SELECT u.id, r.id, CURRENT_TIMESTAMP
FROM users u
CROSS JOIN roles r
WHERE u.username = 'superadmin'
  AND r.code = 'owner'
ON CONFLICT DO NOTHING;

INSERT INTO dicts (dict_type, label, value, status, sort_order)
VALUES
    ('user_status', '启用', '1', 1, 1),
    ('user_status', '禁用', '2', 1, 2),
    ('user_status', '待审核', '3', 1, 3),
    ('user_status', '已锁定', '4', 1, 4),
    ('role_type', '系统角色', '1', 1, 1),
    ('role_type', '自定义角色', '2', 1, 2)
ON CONFLICT DO NOTHING;

-- Module menu titles are scoped to their navigation group. Manual Admin menus
-- remain globally unique through their empty module scope.
DROP INDEX idx_menus_name;
CREATE UNIQUE INDEX idx_menus_name
    ON menus(COALESCE(module_id, ''), name)
    WHERE deleted_at IS NULL AND is_active = 1;

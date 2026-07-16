-- One installed release-directory link means there can be only one current bundle.
UPDATE deploy_versions
SET is_current = 0,
    updated_at = CURRENT_TIMESTAMP
WHERE is_current = 1
  AND id <> (
      SELECT id
      FROM deploy_versions
      WHERE is_current = 1 AND deleted_at IS NULL
      ORDER BY COALESCE(deployed_at, created_at) DESC, id DESC
      LIMIT 1
  );

CREATE UNIQUE INDEX idx_release_deploy_versions_one_current
    ON deploy_versions(is_current)
    WHERE is_current = 1 AND deleted_at IS NULL;

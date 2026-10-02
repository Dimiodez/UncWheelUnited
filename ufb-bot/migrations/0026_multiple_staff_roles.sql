ALTER TABLE server_settings ADD COLUMN moderator_role_ids TEXT NOT NULL DEFAULT '[]';
ALTER TABLE server_settings ADD COLUMN manager_role_ids TEXT NOT NULL DEFAULT '[]';

UPDATE server_settings SET moderator_role_ids=json_array(moderator_role_id)
WHERE moderator_role_id IS NOT NULL AND moderator_role_id<>'';
UPDATE server_settings SET manager_role_ids=json_array(manager_role_id)
WHERE manager_role_id IS NOT NULL AND manager_role_id<>'';

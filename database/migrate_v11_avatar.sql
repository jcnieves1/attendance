-- OfficePal migration: v10 -> v11
-- Run this against an existing OfficePal database to add support for:
--   * Profile pictures — uploaded from "My account", automatically
--     center-cropped, downsized to a small fixed square, and re-encoded as a
--     compact JPEG on the server (see process_avatar_upload() in
--     api/helpers.php), so storage stays bounded no matter what a user
--     uploads. Shown as a small rounded thumbnail next to the person's name
--     on the attendance dashboards, the admin member roster, and the
--     per-person calendar popup. Users can remove their own photo, which
--     also deletes the file from the server.
--
--   mysql -u root -p officepal < database/migrate_v11_avatar.sql
--
-- What changes:
--   * users gets a nullable avatar_filename column — just a generated
--     basename (never the original upload's filename); the real file lives
--     under uploads/avatars/. NULL means no photo.
--
-- Requires the "gd" PHP extension (for image processing) — see README.
--
-- Written with a guarded dynamic ALTER TABLE (no "IF NOT EXISTS" on
-- columns) so it runs safely on both plain MySQL 8 and MariaDB 10.4+, and
-- can be re-run without error if it's already been applied.

SET FOREIGN_KEY_CHECKS = 0;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar_filename');
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE users ADD COLUMN avatar_filename VARCHAR(190) NULL AFTER security_answer_hash',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET FOREIGN_KEY_CHECKS = 1;

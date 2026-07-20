-- OfficePal migration: v5 -> v6
-- Run this against an existing OfficePal database to add support for:
--   * A notification for a user when their join request is approved (a
--     cheerful welcome, naming who approved it) or rejected (an apologetic
--     note, naming who rejected it and how to reach them).
--
--   mysql -u root -p officepal < database/migrate_v6_join_response_notifications.sql
--
-- What changes:
--   * notifications.type gains 'join_request_approved' and
--     'join_request_rejected' alongside the existing 'removed_from_team' and
--     'join_request' values.
--   * notifications gets a nullable actor_email column — a plain-text
--     snapshot of the responding manager/admin's email, so a rejection
--     notification can tell the person who to contact even if that admin's
--     email changes later.
--
-- Written with plain ALTER TABLE / dynamic-SQL guards (no "IF NOT EXISTS" on
-- columns) so it runs on both plain MySQL 8 and MariaDB 10.4+.

SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE notifications
    MODIFY COLUMN type ENUM('removed_from_team','join_request','join_request_approved','join_request_rejected') NOT NULL;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'actor_email');
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE notifications ADD COLUMN actor_email VARCHAR(190) NULL AFTER actor_name',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET FOREIGN_KEY_CHECKS = 1;

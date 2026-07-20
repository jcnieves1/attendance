-- OfficePal migration: v6 -> v7
-- Run this against an existing OfficePal database to add support for:
--   * A per-team "Auto-accept join requests" setting. When on, anyone who
--     finds the team via "Find a team" and requests to join is added
--     immediately as an 'employee' — no admin approval needed.
--   * Two new notification kinds for this mode: 'auto_joined' (told to every
--     owner/admin so they still know who joined, with a "Manage users"
--     shortcut into the Admin area) and 'join_auto_approved' (a cheerful
--     welcome to the person who just auto-joined).
--
--   mysql -u root -p officepal < database/migrate_v7_auto_accept.sql
--
-- Written with plain ALTER TABLE / dynamic-SQL guards (no "IF NOT EXISTS" on
-- columns) so it runs on both plain MySQL 8 and MariaDB 10.4+.

SET FOREIGN_KEY_CHECKS = 0;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teams' AND COLUMN_NAME = 'auto_accept_join_requests');
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE teams ADD COLUMN auto_accept_join_requests TINYINT(1) NOT NULL DEFAULT 0 AFTER join_policy',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE notifications
    MODIFY COLUMN type ENUM(
        'removed_from_team',
        'join_request',
        'join_request_approved',
        'join_request_rejected',
        'auto_joined',
        'join_auto_approved'
    ) NOT NULL;

SET FOREIGN_KEY_CHECKS = 1;

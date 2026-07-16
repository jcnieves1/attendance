-- OfficePal migration: v1 -> v2
-- Run this ONCE against an existing OfficePal database that was created from
-- the original schema.sql (the one with email/token-based invitations and
-- email notifications). If you're starting fresh, ignore this file and just
-- import schema.sql instead.
--
--   mysql -u root -p officepal < database/migrate_v2_inapp_invites.sql
--
-- What changes:
--   * invitations: now targets an existing user (invited_user_id) instead of
--     a raw email + token. Any pending invitations sent to an email that
--     matches a real account are carried over; invitations to email
--     addresses with no matching account are dropped (that flow no longer
--     exists — managers can only invite people who already have accounts).
--   * teams: adds track_weekends (0 = Mon-Fri only, 1 = show all 7 days).
--     Defaults to 0 for every existing team.
--   * attendance: drops the unused manager_notified column.
--   * email_log: dropped entirely — the app no longer sends any email.
--
-- Written with plain ALTER TABLE / dynamic-SQL guards (no "IF NOT EXISTS" on
-- columns) so it runs on both plain MySQL 8 and MariaDB 10.4+.

SET FOREIGN_KEY_CHECKS = 0;

-- --- teams: add the weekday/calendar toggle -------------------------------
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teams' AND COLUMN_NAME = 'track_weekends');
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE teams ADD COLUMN track_weekends TINYINT(1) NOT NULL DEFAULT 0 AFTER description',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- --- invitations: switch from email/token to invited_user_id -------------
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invitations' AND COLUMN_NAME = 'invited_user_id');
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE invitations ADD COLUMN invited_user_id INT UNSIGNED NULL AFTER team_id',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invitations' AND COLUMN_NAME = 'responded_at');
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE invitations ADD COLUMN responded_at DATETIME NULL AFTER created_at',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Carry over any pending invites whose email matches a real account (only
-- possible if the old `email` column still exists on this table).
SET @has_email_col := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invitations' AND COLUMN_NAME = 'email');

SET @sql := IF(@has_email_col > 0,
    'UPDATE invitations i JOIN users u ON u.email = i.email SET i.invited_user_id = u.id WHERE i.invited_user_id IS NULL',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Anything left (invites to emails with no account) can't be represented
-- any more — that "invite someone with no account yet" flow is removed.
DELETE FROM invitations WHERE invited_user_id IS NULL;

ALTER TABLE invitations
    MODIFY COLUMN invited_user_id INT UNSIGNED NOT NULL,
    MODIFY COLUMN status ENUM('pending','accepted','declined','revoked') NOT NULL DEFAULT 'pending';

-- Drop the old email/token columns and their index/constraint if present.
SET @has_email_idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invitations' AND INDEX_NAME = 'idx_invitations_email');
SET @sql := IF(@has_email_idx > 0, 'ALTER TABLE invitations DROP INDEX idx_invitations_email', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(@has_email_col > 0, 'ALTER TABLE invitations DROP COLUMN email', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invitations' AND COLUMN_NAME = 'token');
SET @sql := IF(@has_col > 0, 'ALTER TABLE invitations DROP COLUMN token', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invitations' AND COLUMN_NAME = 'expires_at');
SET @sql := IF(@has_col > 0, 'ALTER TABLE invitations DROP COLUMN expires_at', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invitations' AND COLUMN_NAME = 'accepted_at');
SET @sql := IF(@has_col > 0, 'ALTER TABLE invitations DROP COLUMN accepted_at', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invitations' AND CONSTRAINT_NAME = 'fk_invitations_invited_user');
SET @sql := IF(@has_fk = 0,
    'ALTER TABLE invitations ADD CONSTRAINT fk_invitations_invited_user FOREIGN KEY (invited_user_id) REFERENCES users(id) ON DELETE CASCADE',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invitations' AND INDEX_NAME = 'idx_invitations_invited_user');
SET @sql := IF(@has_idx = 0, 'ALTER TABLE invitations ADD KEY idx_invitations_invited_user (invited_user_id, status)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invitations' AND INDEX_NAME = 'idx_invitations_team_status');
SET @sql := IF(@has_idx = 0, 'ALTER TABLE invitations ADD KEY idx_invitations_team_status (team_id, status)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- --- attendance: drop the unused email-notification flag ------------------
SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance' AND COLUMN_NAME = 'manager_notified');
SET @sql := IF(@has_col > 0, 'ALTER TABLE attendance DROP COLUMN manager_notified', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- --- email_log: no longer needed, the app sends no email at all ----------
DROP TABLE IF EXISTS email_log;

SET FOREIGN_KEY_CHECKS = 1;

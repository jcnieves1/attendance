-- OfficePal migration: v11 -> v12
-- Run this against an existing OfficePal database to add support for:
--   * A per-team "Allow future check-ins" toggle in the Admin area's "Days
--     tracked" card. Off (the default, unchanged behavior) locks check-ins
--     to today or a past day; on lets members check in for upcoming days
--     too. Enforced both client-side (day cells are simply not disabled)
--     and server-side (api/attendance/checkin.php rejects a future date
--     for teams where this is off), so it can't be bypassed by calling the
--     API directly.
--
--   mysql -u root -p officepal < database/migrate_v12_allow_future_checkin.sql
--
-- What changes:
--   * teams gets a non-null allow_future_checkin TINYINT(1), default 0.
--
-- Written with a guarded dynamic ALTER TABLE (no "IF NOT EXISTS" on
-- columns) so it runs safely on both plain MySQL 8 and MariaDB 10.4+, and
-- can be re-run without error if it's already been applied.

SET FOREIGN_KEY_CHECKS = 0;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teams' AND COLUMN_NAME = 'allow_future_checkin');
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE teams ADD COLUMN allow_future_checkin TINYINT(1) NOT NULL DEFAULT 0 AFTER track_weekends',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET FOREIGN_KEY_CHECKS = 1;

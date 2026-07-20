-- OfficePal migration: v7 -> v8
-- Run this against an existing OfficePal database to add support for:
--   * A personal "default team" per user — the team auto-selected the next
--     time they log in, set from a checkbox below "My favorite office days"
--     on that team's "This week" tab.
--
--   mysql -u root -p officepal < database/migrate_v8_default_team.sql
--
-- What changes:
--   * users gets a nullable default_team_id column, FK'd to teams(id) with
--     ON DELETE SET NULL (if the team itself is ever deleted). If a user is
--     instead just removed from their default team (membership only), the
--     app handles that explicitly — see api/teams/remove_member.php — by
--     picking another team they still belong to, or clearing it to NULL if
--     none are left.
--
-- Written with plain ALTER TABLE / dynamic-SQL guards (no "IF NOT EXISTS" on
-- columns or constraints) so it runs on both plain MySQL 8 and MariaDB 10.4+.

SET FOREIGN_KEY_CHECKS = 0;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'default_team_id');
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE users ADD COLUMN default_team_id INT UNSIGNED NULL AFTER theme',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'fk_users_default_team');
SET @sql := IF(@fk_exists = 0,
    'ALTER TABLE users ADD CONSTRAINT fk_users_default_team FOREIGN KEY (default_team_id) REFERENCES teams(id) ON DELETE SET NULL',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET FOREIGN_KEY_CHECKS = 1;

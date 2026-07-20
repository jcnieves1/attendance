-- OfficePal migration: v3 -> v4
-- Run this against an existing OfficePal database to add support for:
--   * Team name uniqueness (validated in the UI before saving a rename).
--   * Team description editing from the Admin area (column already existed).
--   * A per-team join policy: 'invite_only' (default, unchanged behavior) or
--     'open' (discoverable + directly requestable by any user).
--   * Join requests: when a user finds an 'open' team and asks to join, a
--     request is queued for a team owner/admin to accept or reject from the
--     new "Join requests" panel in the Admin area. Approved requests add the
--     person as an 'employee' — never as an admin — matching invited members.
--
--   mysql -u root -p officepal < database/migrate_v4_join_requests.sql
--
-- Written with plain ALTER TABLE / dynamic-SQL guards (no "IF NOT EXISTS" on
-- columns) so it runs on both plain MySQL 8 and MariaDB 10.4+.

SET FOREIGN_KEY_CHECKS = 0;

-- 1) teams.join_policy
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teams' AND COLUMN_NAME = 'join_policy');
SET @sql := IF(@col_exists = 0,
    "ALTER TABLE teams ADD COLUMN join_policy ENUM('invite_only','open') NOT NULL DEFAULT 'invite_only' AFTER description",
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Unique index on teams.name — only added if the existing data has no
-- duplicate names already (a fresh/typical install won't). If duplicates
-- exist, the index is skipped rather than failing the whole migration; rename
-- the clashing teams from the Admin area (now validated live) and re-run this
-- file to add the constraint.
SET @dupe_count := (SELECT COUNT(*) FROM (
    SELECT name FROM teams GROUP BY name HAVING COUNT(*) > 1
) AS dupes);
SET @index_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teams' AND INDEX_NAME = 'uniq_teams_name');
SET @sql := IF(@index_exists = 0 AND @dupe_count = 0,
    'ALTER TABLE teams ADD UNIQUE KEY uniq_teams_name (name)',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) join_requests: one row per "please let me join" ask from a user who
-- found the team via the "Find a team" search (only possible for 'open'
-- teams). Status starts 'pending' and is resolved by a team owner/admin.
CREATE TABLE IF NOT EXISTS join_requests (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    team_id         INT UNSIGNED NOT NULL,
    user_id         INT UNSIGNED NOT NULL,
    status          ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at    DATETIME NULL,
    CONSTRAINT fk_join_requests_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    CONSTRAINT fk_join_requests_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    KEY idx_join_requests_team_status (team_id, status),
    KEY idx_join_requests_user_status (user_id, status)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;

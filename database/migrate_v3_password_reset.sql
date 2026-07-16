-- OfficePal migration: v2 -> v3
-- Run this against an existing OfficePal database to add support for:
--   * Self-service "forgot password" via an optional security question.
--   * Year + month filtering on the attendance dashboards (no schema change
--     needed for that part — it's query-level only).
--   * Excel export of the attendance dashboard (no schema change needed).
--
--   mysql -u root -p officepal < database/migrate_v3_password_reset.sql
--
-- What changes:
--   * users: adds security_question (nullable) and security_answer_hash
--     (nullable, bcrypt-hashed via password_hash()). Both stay NULL until a
--     user sets them from My account or at registration. Accounts that never
--     set one can still be helped — a manager/admin of one of their teams can
--     reset their password from the team's Admin area instead.
--
-- Written with plain ALTER TABLE / dynamic-SQL guards (no "IF NOT EXISTS" on
-- columns) so it runs on both plain MySQL 8 and MariaDB 10.4+.

SET FOREIGN_KEY_CHECKS = 0;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'security_question');
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE users ADD COLUMN security_question VARCHAR(150) NULL AFTER theme',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'security_answer_hash');
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE users ADD COLUMN security_answer_hash VARCHAR(255) NULL AFTER security_question',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET FOREIGN_KEY_CHECKS = 1;

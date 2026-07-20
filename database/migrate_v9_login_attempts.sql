-- OfficePal migration: v8 -> v9
-- Run this against an existing OfficePal database to add support for:
--   * A math CAPTCHA challenge on the login page, and basic rate-limiting of
--     failed login attempts per email — together, a defense against
--     scripted brute-force / denial-of-service style login attempts.
--
--   mysql -u root -p officepal < database/migrate_v9_login_attempts.sql
--
-- What changes:
--   * A new login_attempts table logs every login POST (success or failure)
--     with the email tried, the caller's IP, and a timestamp. api/auth/
--     login.php checks this before anything else: 5+ failures for the same
--     email within the last 15 minutes blocks further attempts with a 429
--     until the window rolls off — no manual unlock needed.
--   * The CAPTCHA answer itself is never stored in the database — it lives
--     only in the PHP session for the few minutes between fetching the
--     challenge and submitting the login form (see api/helpers.php).

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS login_attempts (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email       VARCHAR(190) NOT NULL,
    ip_address  VARCHAR(45) NULL,
    success     TINYINT(1) NOT NULL DEFAULT 0,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_login_attempts_email_time (email, created_at)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;

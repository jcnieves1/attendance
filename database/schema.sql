-- OfficePal database schema (MySQL / MariaDB)
-- Import with:  mysql -u root -p officepal < schema.sql
-- (create the database first:  CREATE DATABASE officepal CHARACTER SET utf8mb4;)
--
-- Upgrading an existing install? Don't re-run this file — it will silently
-- no-op on tables that already exist with the old structure. Use
-- database/migrate_v2_inapp_invites.sql instead (see its header comment).

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- Users: anyone can self-register with an email, password and real name.
-- Any user can later create a team and become its manager/owner.
-- ---------------------------------------------------------------------------
-- security_question / security_answer_hash back the self-service "forgot
-- password" flow: both are optional (NULL until the user sets them, either
-- at registration or later from My account). If a user never sets one, the
-- only way to recover their password is for a manager/admin of one of their
-- teams to reset it (see api/teams/reset_member_password.php).
-- avatar_filename is just a generated basename (e.g. "avatar_a1b2c3.jpg"),
-- never the original upload's filename — the actual file always lives in
-- uploads/avatars/ after being center-cropped, downsized, and re-encoded by
-- process_avatar_upload() (see api/helpers.php). NULL means no photo, and
-- the UI falls back to showing just the name with no image.
CREATE TABLE IF NOT EXISTS users (
    id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email                VARCHAR(190) NOT NULL UNIQUE,
    password_hash        VARCHAR(255) NOT NULL,
    full_name            VARCHAR(150) NOT NULL,
    language             ENUM('en','es') NOT NULL DEFAULT 'en',
    theme                VARCHAR(30) NOT NULL DEFAULT 'sunrise',
    default_team_id      INT UNSIGNED NULL COMMENT 'team auto-selected on login, if still a member of it',
    security_question    VARCHAR(150) NULL,
    security_answer_hash VARCHAR(255) NULL,
    avatar_filename      VARCHAR(190) NULL COMMENT 'generated basename under uploads/avatars/, or NULL',
    created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Teams (aka "groups"): created by a user, who becomes the owning manager.
-- track_weekends controls whether Saturday/Sunday are tracked at all for
-- this team — most teams only care about Mon-Fri, so keeping this off by
-- default hides weekend columns everywhere in the UI to save screen space.
-- ---------------------------------------------------------------------------
-- name is globally unique (validated live in the Admin area before saving a
-- rename). join_policy controls whether the team can be found and requested
-- via "Find a team" ('open') or only reached via a manager's invitation
-- ('invite_only', the default — unchanged behavior from before).
-- auto_accept_join_requests only matters for 'open' teams: when on, a "Find a
-- team" request is approved immediately (no admin action needed) instead of
-- waiting in the Join requests panel.
CREATE TABLE IF NOT EXISTS teams (
    id                          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name                        VARCHAR(150) NOT NULL UNIQUE,
    description                 VARCHAR(255) NULL,
    join_policy                 ENUM('invite_only','open') NOT NULL DEFAULT 'invite_only',
    auto_accept_join_requests   TINYINT(1) NOT NULL DEFAULT 0,
    owner_id        INT UNSIGNED NOT NULL,
    track_weekends  TINYINT(1) NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_teams_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- users.default_team_id references teams, so this FK is added here rather
-- than inline on the users table above, which is defined before teams exists.
ALTER TABLE users
    ADD CONSTRAINT fk_users_default_team FOREIGN KEY (default_team_id) REFERENCES teams(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Team membership + role. 'owner' = the manager who created the team.
-- 'admin' = an assistant manager the owner promoted, can manage the group
-- almost like the owner (invite people, set suggested days, view dashboard).
-- 'employee' = regular member who tracks their own attendance.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_members (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    team_id         INT UNSIGNED NOT NULL,
    user_id         INT UNSIGNED NOT NULL,
    role            ENUM('owner','admin','employee') NOT NULL DEFAULT 'employee',
    status          ENUM('active','invited') NOT NULL DEFAULT 'active',
    joined_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_team_user (team_id, user_id),
    CONSTRAINT fk_members_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    CONSTRAINT fk_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Invitations: entirely in-app now. A manager/admin picks an existing user
-- account (invited_user_id) to invite to their team — no email is sent, and
-- the invited person accepts or declines from inside the app the next time
-- they log in (see api/invitations/*.php).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invitations (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    team_id         INT UNSIGNED NOT NULL,
    invited_user_id INT UNSIGNED NOT NULL,
    invited_by      INT UNSIGNED NOT NULL,
    role            ENUM('admin','employee') NOT NULL DEFAULT 'employee',
    status          ENUM('pending','accepted','declined','revoked') NOT NULL DEFAULT 'pending',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at    DATETIME NULL,
    CONSTRAINT fk_invitations_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    CONSTRAINT fk_invitations_invited_user FOREIGN KEY (invited_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_invitations_inviter FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE,
    KEY idx_invitations_invited_user (invited_user_id, status),
    KEY idx_invitations_team_status (team_id, status)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Suggested days: the standing weekly pattern a manager/admin sets for the
-- team ("attend Monday & Wednesday"). Employees see this as the current
-- suggestion; it stays in effect until the manager changes it again.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suggested_days (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    team_id         INT UNSIGNED NOT NULL,
    day_of_week     TINYINT UNSIGNED NOT NULL COMMENT '0=Mon .. 6=Sun',
    set_by          INT UNSIGNED NOT NULL,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_team_day (team_id, day_of_week),
    CONSTRAINT fk_suggested_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    CONSTRAINT fk_suggested_setby FOREIGN KEY (set_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Favorite days: an employee's own personal preference, independent of the
-- manager's suggestion. Purely informational / for the employee's own view.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS favorite_days (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED NOT NULL,
    team_id         INT UNSIGNED NOT NULL,
    day_of_week     TINYINT UNSIGNED NOT NULL COMMENT '0=Mon .. 6=Sun',
    UNIQUE KEY uniq_user_team_day (user_id, team_id, day_of_week),
    CONSTRAINT fk_favorite_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_favorite_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Attendance: one row per user/team/date a check-in was logged.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED NOT NULL,
    team_id         INT UNSIGNED NOT NULL,
    attendance_date DATE NOT NULL,
    checked_in_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_user_team_date (user_id, team_id, attendance_date),
    CONSTRAINT fk_attendance_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_attendance_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Join requests: a user who found an 'open' team via "Find a team" asks to
-- join; a team owner/admin accepts or rejects it from the Admin area's
-- "Join requests" panel. Approval always adds the person as 'employee'.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Notifications: shown in the 🔔 bell. Currently two kinds — a user is told
-- when a manager/admin removes them from a team, and every owner/admin of a
-- team is told when someone requests to join it via "Find a team".
-- team_name / actor_name are denormalized snapshots so the notification still
-- reads sensibly even after the team or the other person's account changes.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED NOT NULL COMMENT 'recipient',
    type            ENUM('removed_from_team','join_request','join_request_approved','join_request_rejected','auto_joined','join_auto_approved') NOT NULL,
    team_id         INT UNSIGNED NULL,
    team_name       VARCHAR(150) NOT NULL,
    actor_name      VARCHAR(150) NULL COMMENT 'e.g. the requester (join_request) or the responding admin (join_request_approved/rejected)',
    actor_email     VARCHAR(190) NULL COMMENT 'responding admin''s email, so a rejection notification can tell the person who to contact',
    status          ENUM('unread','read') NOT NULL DEFAULT 'unread',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at         DATETIME NULL,
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
    KEY idx_notifications_user_status (user_id, status)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Login attempts: backs the login page's brute-force guard. Every login POST
-- (success or failure) is logged with the email tried, the caller's IP, and
-- a timestamp; api/auth/login.php blocks further tries for an email once it
-- sees 5+ failures in the last 15 minutes. Paired with a math CAPTCHA
-- challenge (session-only, never stored here — see api/helpers.php) that
-- must be solved fresh on every attempt.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_attempts (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email       VARCHAR(190) NOT NULL,
    ip_address  VARCHAR(45) NULL,
    success     TINYINT(1) NOT NULL DEFAULT 0,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_login_attempts_email_time (email, created_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Team messages: the Admin area's "Messages board" — rich-text announcements
-- a manager/admin posts for their team, shown above "My favorite office
-- days" on everyone's "This week" tab (editable/removable/reorderable from
-- both places by a manager; read-only for employees). Content is passed
-- through sanitize_rich_text() (api/helpers.php) — a whitelist-based
-- sanitizer built on DOMDocument — before it's ever written here, so no
-- <script>, event-handler attribute, or javascript:/data: link can make it
-- into the database. sort_order is a plain 0-based position, rewritten
-- wholesale on every drag-and-drop reorder.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_messages (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    team_id     INT UNSIGNED NOT NULL,
    content     TEXT NOT NULL COMMENT 'sanitized rich text — safe tag whitelist only',
    sort_order  INT NOT NULL DEFAULT 0,
    created_by  INT UNSIGNED NOT NULL,
    updated_by  INT UNSIGNED NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_team_messages_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    CONSTRAINT fk_team_messages_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_team_messages_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    KEY idx_team_messages_team_order (team_id, sort_order)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;

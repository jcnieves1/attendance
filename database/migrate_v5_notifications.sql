-- OfficePal migration: v4 -> v5
-- Run this against an existing OfficePal database to add support for:
--   * A notification for a user when a manager/admin removes them from a
--     team (shown in their 🔔 bell, with an "Acknowledge" action).
--   * A notification for every owner/admin of a team when someone requests
--     to join it via "Find a team" (shown in their 🔔 bell, with a "Review"
--     action that jumps straight to that team's Admin area).
--
--   mysql -u root -p officepal < database/migrate_v5_notifications.sql
--
-- team_name / actor_name are denormalized snapshots (not live joins) so a
-- notification still reads sensibly even if the team is renamed or deleted,
-- or the requester's account changes, after the notification was created.

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS notifications (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED NOT NULL COMMENT 'recipient',
    type            ENUM('removed_from_team','join_request') NOT NULL,
    team_id         INT UNSIGNED NULL,
    team_name       VARCHAR(150) NOT NULL,
    actor_name      VARCHAR(150) NULL COMMENT 'e.g. the person requesting to join, for join_request notifications',
    status          ENUM('unread','read') NOT NULL DEFAULT 'unread',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at         DATETIME NULL,
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
    KEY idx_notifications_user_status (user_id, status)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;

-- OfficePal migration: v9 -> v10
-- Run this against an existing OfficePal database to add support for:
--   * The Admin area's "Messages board" — rich-text announcements a
--     manager/admin can post for their team, shown above "My favorite
--     office days" on everyone's "This week" tab, editable/removable/
--     reorderable (drag & drop) from both the Admin area and "This week".
--
--   mysql -u root -p officepal < database/migrate_v10_team_messages.sql
--
-- Content is passed through sanitize_rich_text() (see api/helpers.php) —a
-- whitelist-based sanitizer built on PHP's DOMDocument — before it's ever
-- written here, so no <script>, event-handler attribute, or javascript:/
-- data: link can make it into the database in the first place. Only a small
-- safe set of formatting tags survives (bold/italic/underline/lists/links).

SET FOREIGN_KEY_CHECKS = 0;

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

<?php
// Marks every unread notification for the logged-in user as read in one go —
// used by the notifications modal's "Acknowledge all" button. Irreversible
// by design: the UI warns about this before calling in (there's no "unread"
// state to restore afterwards).
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();

db()->prepare('UPDATE notifications SET status = "read", read_at = NOW() WHERE user_id = ? AND status = "unread"')
    ->execute([$userId]);

json_response(['ok' => true]);

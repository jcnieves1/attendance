<?php
// Unread 🔔-bell notifications for the logged-in user — shown alongside
// pending invitations in the notifications modal.
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();

$stmt = db()->prepare(
    'SELECT id, type, team_id, team_name, actor_name, actor_email, created_at
     FROM notifications
     WHERE user_id = ? AND status = "unread"
     ORDER BY created_at DESC'
);
$stmt->execute([$userId]);

json_response(['ok' => true, 'notifications' => $stmt->fetchAll()]);

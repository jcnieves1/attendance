<?php
// Marks one notification as read — used both for a plain "Acknowledge" on an
// informational notification (e.g. removed_from_team) and right before
// navigating away on an actionable one (e.g. join_request's "Review").
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$input = read_json_body();
$notificationId = (int) ($input['notification_id'] ?? 0);

if (!$notificationId) {
    json_error('missing_notification_id', 422);
}

$stmt = db()->prepare('UPDATE notifications SET status = "read", read_at = NOW() WHERE id = ? AND user_id = ?');
$stmt->execute([$notificationId, $userId]);

json_response(['ok' => true]);

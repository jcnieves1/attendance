<?php
// A manager/admin removes a message from their team's "Messages board".
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$input = read_json_body();
$messageId = (int) ($input['message_id'] ?? 0);

if (!$messageId) {
    json_error('invalid_input', 422);
}

$pdo = db();

$stmt = $pdo->prepare('SELECT team_id FROM team_messages WHERE id = ?');
$stmt->execute([$messageId]);
$teamId = $stmt->fetchColumn();
if (!$teamId) {
    json_error('message_not_found', 404);
}

require_manager($userId, (int) $teamId);

$pdo->prepare('DELETE FROM team_messages WHERE id = ?')->execute([$messageId]);

json_response(['ok' => true]);

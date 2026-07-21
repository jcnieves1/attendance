<?php
// A manager/admin posts a new message to their team's "Messages board".
// Content is run through sanitize_rich_text() before it's ever written to
// the database — see api/helpers.php for what survives.
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$input = read_json_body();
$teamId = (int) ($input['team_id'] ?? 0);
$content = (string) ($input['content'] ?? '');

if (!$teamId || trim(strip_tags($content)) === '') {
    json_error('invalid_input', 422, 'Please write a message before saving.');
}
if (mb_strlen($content) > 5000) {
    json_error('message_too_long', 422, 'That message is too long. Please shorten it.');
}

require_manager($userId, $teamId);

$sanitized = sanitize_rich_text($content);
if (trim(strip_tags($sanitized)) === '') {
    json_error('invalid_input', 422, 'Please write a message before saving.');
}

$pdo = db();

$stmt = $pdo->prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 FROM team_messages WHERE team_id = ?');
$stmt->execute([$teamId]);
$nextOrder = (int) $stmt->fetchColumn();

$stmt = $pdo->prepare('INSERT INTO team_messages (team_id, content, sort_order, created_by) VALUES (?, ?, ?, ?)');
$stmt->execute([$teamId, $sanitized, $nextOrder, $userId]);

json_response(['ok' => true, 'id' => (int) $pdo->lastInsertId()]);

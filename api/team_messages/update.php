<?php
// A manager/admin edits an existing message on their team's "Messages
// board" — from either the Admin area or directly on "This week". Content
// is re-sanitized on every save, same as create.php.
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$input = read_json_body();
$messageId = (int) ($input['message_id'] ?? 0);
$content = (string) ($input['content'] ?? '');

if (!$messageId || trim(strip_tags($content)) === '') {
    json_error('invalid_input', 422, 'Please write a message before saving.');
}
if (mb_strlen($content) > 5000) {
    json_error('message_too_long', 422, 'That message is too long. Please shorten it.');
}

$pdo = db();

$stmt = $pdo->prepare('SELECT team_id FROM team_messages WHERE id = ?');
$stmt->execute([$messageId]);
$teamId = $stmt->fetchColumn();
if (!$teamId) {
    json_error('message_not_found', 404);
}

require_manager($userId, (int) $teamId);

$sanitized = sanitize_rich_text($content);
if (trim(strip_tags($sanitized)) === '') {
    json_error('invalid_input', 422, 'Please write a message before saving.');
}

$pdo->prepare('UPDATE team_messages SET content = ?, updated_by = ? WHERE id = ?')
    ->execute([$sanitized, $userId, $messageId]);

json_response(['ok' => true]);

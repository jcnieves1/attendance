<?php
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$input = read_json_body();
$teamId = (int) ($input['team_id'] ?? 0);
$targetUserId = (int) ($input['user_id'] ?? 0);

if (!$teamId || !$targetUserId) {
    json_error('invalid_input', 422);
}

require_manager($userId, $teamId);

$stmt = db()->prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?');
$stmt->execute([$teamId, $targetUserId]);
$target = $stmt->fetch();
if ($target && $target['role'] === 'owner') {
    json_error('cannot_remove_owner', 422, 'The team owner cannot be removed.');
}

db()->prepare('DELETE FROM team_members WHERE team_id = ? AND user_id = ?')->execute([$teamId, $targetUserId]);

json_response(['ok' => true]);

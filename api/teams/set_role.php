<?php
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$input = read_json_body();
$teamId = (int) ($input['team_id'] ?? 0);
$targetUserId = (int) ($input['user_id'] ?? 0);
$role = $input['role'] ?? '';

if (!$teamId || !$targetUserId || !in_array($role, ['admin', 'employee'], true)) {
    json_error('invalid_input', 422);
}

// Only the owner can promote/demote admins.
require_owner($userId, $teamId);

if ($targetUserId === $userId) {
    json_error('cannot_change_self', 422, 'The team owner role cannot be changed.');
}

$stmt = db()->prepare(
    'UPDATE team_members SET role = ? WHERE team_id = ? AND user_id = ? AND role != "owner"'
);
$stmt->execute([$role, $teamId, $targetUserId]);

json_response(['ok' => true]);

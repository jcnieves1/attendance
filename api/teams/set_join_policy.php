<?php
// Lets a manager/admin tag the team as 'invite_only' (default — only reachable
// via a manager's invitation) or 'open' (discoverable and directly
// requestable by any user through "Find a team").
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$input = read_json_body();
$teamId = (int) ($input['team_id'] ?? 0);
$joinPolicy = $input['join_policy'] ?? '';

if (!$teamId || !in_array($joinPolicy, ['invite_only', 'open'], true)) {
    json_error('invalid_input', 422);
}

require_manager($userId, $teamId);

db()->prepare('UPDATE teams SET join_policy = ? WHERE id = ?')->execute([$joinPolicy, $teamId]);

json_response(['ok' => true, 'join_policy' => $joinPolicy]);

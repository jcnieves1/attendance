<?php
// Lets a manager/admin toggle "Auto-accept join requests" for the team. Only
// meaningful for 'open' teams — when on, a "Find a team" request is approved
// immediately instead of waiting in the Join requests panel.
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$input = read_json_body();
$teamId = (int) ($input['team_id'] ?? 0);

if (!$teamId || !array_key_exists('auto_accept', $input)) {
    json_error('invalid_input', 422);
}

require_manager($userId, $teamId);

$autoAccept = !empty($input['auto_accept']) ? 1 : 0;

db()->prepare('UPDATE teams SET auto_accept_join_requests = ? WHERE id = ?')->execute([$autoAccept, $teamId]);

json_response(['ok' => true, 'auto_accept' => (bool) $autoAccept]);

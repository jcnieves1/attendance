<?php
// Lets a manager/admin choose whether members can check in for a future
// date (off by default — locked to today/past only). api/attendance/
// checkin.php enforces this same flag server-side, so toggling it here is
// the actual lock/unlock, not just a client-side convenience.
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$input = read_json_body();
$teamId = (int) ($input['team_id'] ?? 0);

if (!$teamId || !array_key_exists('allow_future_checkin', $input)) {
    json_error('invalid_input', 422);
}

require_manager($userId, $teamId);

$allowFutureCheckin = !empty($input['allow_future_checkin']) ? 1 : 0;

db()->prepare('UPDATE teams SET allow_future_checkin = ? WHERE id = ?')->execute([$allowFutureCheckin, $teamId]);

json_response(['ok' => true, 'allow_future_checkin' => (bool) $allowFutureCheckin]);

<?php
// Lets a manager/admin choose whether the team tracks Mon-Fri only (the
// default — keeps the UI compact) or the full Mon-Sun calendar week.
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$input = read_json_body();
$teamId = (int) ($input['team_id'] ?? 0);

if (!$teamId || !array_key_exists('track_weekends', $input)) {
    json_error('invalid_input', 422);
}

require_manager($userId, $teamId);

$trackWeekends = !empty($input['track_weekends']) ? 1 : 0;

db()->prepare('UPDATE teams SET track_weekends = ? WHERE id = ?')->execute([$trackWeekends, $teamId]);

json_response(['ok' => true, 'track_weekends' => (bool) $trackWeekends]);

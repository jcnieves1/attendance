<?php
// Sets (or clears) the logged-in user's default team — the one automatically
// selected the next time they log in. Surfaced as a checkbox below "My
// favorite office days" on that team's "This week" tab.
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$input = read_json_body();

// team_id may be explicitly null (or omitted) to clear the default.
$teamId = isset($input['team_id']) && $input['team_id'] !== null ? (int) $input['team_id'] : null;

if ($teamId !== null) {
    // Can only default to a team you're actually an active member of.
    require_member($userId, $teamId);
}

db()->prepare('UPDATE users SET default_team_id = ? WHERE id = ?')->execute([$teamId, $userId]);

json_response(['ok' => true, 'default_team_id' => $teamId]);

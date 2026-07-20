<?php
// Lets a manager/admin rename the team and/or edit its description from the
// Admin area's "Team settings" panel. Name must stay unique across the whole
// system — re-checked here server-side even though the UI already validates
// it live, since the name could have been taken by someone else in the gap
// between the last keystroke and clicking Save.
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$input = read_json_body();
$teamId = (int) ($input['team_id'] ?? 0);
$name = trim($input['name'] ?? '');
$description = trim($input['description'] ?? '');

if (!$teamId || $name === '') {
    json_error('invalid_input', 422, 'A team and a name are required.');
}

require_manager($userId, $teamId);
$pdo = db();

$stmt = $pdo->prepare('SELECT id FROM teams WHERE LOWER(name) = LOWER(?) AND id != ?');
$stmt->execute([$name, $teamId]);
if ($stmt->fetch()) {
    json_error('name_taken', 409, 'That team name is already in use. Please choose another.');
}

$stmt = $pdo->prepare('UPDATE teams SET name = ?, description = ? WHERE id = ?');
$stmt->execute([$name, $description ?: null, $teamId]);

json_response(['ok' => true, 'name' => $name, 'description' => $description]);

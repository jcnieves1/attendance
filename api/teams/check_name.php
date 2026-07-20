<?php
// Live uniqueness check used by the Admin area's "Team settings" form while
// the manager is typing a new team name, before they actually save it.
// Comparison is case-insensitive so "Sales" and "sales" are treated as the
// same name (matches the case-insensitive UNIQUE index added in migrate_v4).
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$name = trim($_GET['name'] ?? '');
$teamId = (int) ($_GET['team_id'] ?? 0);

if ($name === '') {
    json_response(['ok' => true, 'available' => false]);
}

$sql = 'SELECT id FROM teams WHERE LOWER(name) = LOWER(?)';
$params = [$name];
if ($teamId) {
    // Editing an existing team: its own current name shouldn't count as taken.
    $sql .= ' AND id != ?';
    $params[] = $teamId;
}

$stmt = db()->prepare($sql);
$stmt->execute($params);

json_response(['ok' => true, 'available' => !$stmt->fetch()]);

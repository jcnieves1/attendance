<?php
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();

$stmt = db()->prepare(
    'SELECT t.id, t.name, t.description, t.owner_id, tm.role,
            (SELECT COUNT(*) FROM team_members m2 WHERE m2.team_id = t.id AND m2.status = "active") AS member_count
     FROM teams t
     JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = ? AND tm.status = "active"
     ORDER BY t.name'
);
$stmt->execute([$userId]);
$teams = $stmt->fetchAll();

json_response(['ok' => true, 'teams' => $teams]);

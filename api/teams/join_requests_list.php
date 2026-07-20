<?php
// Lists pending join requests for a team — feeds the Admin area's
// "Join requests" panel. Manager-only, same as the invite panel.
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$teamId = (int) ($_GET['team_id'] ?? 0);
if (!$teamId) {
    json_error('missing_team_id', 422);
}

require_manager($userId, $teamId);

$stmt = db()->prepare(
    'SELECT jr.id, u.id AS user_id, u.full_name, u.email, jr.created_at
     FROM join_requests jr
     JOIN users u ON u.id = jr.user_id
     WHERE jr.team_id = ? AND jr.status = "pending"
     ORDER BY jr.created_at ASC'
);
$stmt->execute([$teamId]);

json_response(['ok' => true, 'requests' => $stmt->fetchAll()]);

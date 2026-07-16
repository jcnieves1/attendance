<?php
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$teamId = (int) ($_GET['team_id'] ?? 0);
if (!$teamId) {
    json_error('missing_team_id', 422);
}
require_member($userId, $teamId);

$stmt = db()->prepare('SELECT day_of_week FROM favorite_days WHERE user_id = ? AND team_id = ?');
$stmt->execute([$userId, $teamId]);

json_response(['ok' => true, 'days' => array_map('intval', array_column($stmt->fetchAll(), 'day_of_week'))]);

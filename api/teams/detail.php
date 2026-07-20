<?php
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$teamId = (int) ($_GET['team_id'] ?? 0);
if (!$teamId) {
    json_error('missing_team_id', 422);
}

$membership = require_member($userId, $teamId);
$pdo = db();

$stmt = $pdo->prepare('SELECT id, name, description, owner_id, track_weekends, join_policy, auto_accept_join_requests FROM teams WHERE id = ?');
$stmt->execute([$teamId]);
$team = $stmt->fetch();
if (!$team) {
    json_error('team_not_found', 404);
}

$stmt = $pdo->prepare(
    'SELECT u.id, u.full_name, u.email, tm.role, tm.joined_at
     FROM team_members tm
     JOIN users u ON u.id = tm.user_id
     WHERE tm.team_id = ? AND tm.status = "active"
     ORDER BY FIELD(tm.role, "owner", "admin", "employee"), u.full_name'
);
$stmt->execute([$teamId]);
$members = $stmt->fetchAll();

$stmt = $pdo->prepare('SELECT day_of_week FROM suggested_days WHERE team_id = ?');
$stmt->execute([$teamId]);
$suggestedDays = array_map('intval', array_column($stmt->fetchAll(), 'day_of_week'));

json_response([
    'ok' => true,
    'team' => $team,
    'my_role' => $membership['role'],
    'members' => $members,
    'suggested_days' => $suggestedDays,
]);

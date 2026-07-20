<?php
// A user asks to join a team they found via "Find a team". Only allowed for
// teams tagged join_policy='open'. This never joins the team directly — it
// queues a pending join_requests row for a team owner/admin to accept or
// reject from the Admin area's "Join requests" panel.
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$input = read_json_body();
$teamId = (int) ($input['team_id'] ?? 0);

if (!$teamId) {
    json_error('invalid_input', 422);
}

$pdo = db();

$stmt = $pdo->prepare('SELECT id, name, join_policy FROM teams WHERE id = ?');
$stmt->execute([$teamId]);
$team = $stmt->fetch();
if (!$team) {
    json_error('team_not_found', 404);
}
if ($team['join_policy'] !== 'open') {
    json_error('invite_only', 403, 'This team is invite-only.');
}

$stmt = $pdo->prepare('SELECT id FROM team_members WHERE team_id = ? AND user_id = ? AND status = "active"');
$stmt->execute([$teamId, $userId]);
if ($stmt->fetch()) {
    json_error('already_member', 409, 'You are already a member of this team.');
}

$stmt = $pdo->prepare('SELECT id FROM join_requests WHERE team_id = ? AND user_id = ? AND status = "pending"');
$stmt->execute([$teamId, $userId]);
if ($stmt->fetch()) {
    json_error('already_requested', 409, 'You already have a pending request to join this team.');
}

$pdo->prepare('INSERT INTO join_requests (team_id, user_id, status) VALUES (?, ?, "pending")')
    ->execute([$teamId, $userId]);

// Let every owner/admin of the team know someone's waiting on their decision.
$stmt = $pdo->prepare('SELECT full_name FROM users WHERE id = ?');
$stmt->execute([$userId]);
$requesterName = (string) $stmt->fetchColumn();
foreach (manager_user_ids_for_team($teamId) as $managerId) {
    create_notification($managerId, 'join_request', $teamId, $team['name'], $requesterName);
}

json_response(['ok' => true]);

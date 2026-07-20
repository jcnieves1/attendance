<?php
// A user asks to join a team they found via "Find a team". Only allowed for
// teams tagged join_policy='open'.
//
// Normally this just queues a pending join_requests row for a team
// owner/admin to accept or reject from the Admin area's "Join requests"
// panel. But if the team has "Auto-accept join requests" turned on, the
// person is added immediately instead — no admin action needed — and
// everyone still gets a notification about it: the new member gets a
// cheerful welcome, and every owner/admin gets an FYI with a shortcut to
// manage users, so they stay aware of who's joining even though they don't
// have to approve anything.
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$input = read_json_body();
$teamId = (int) ($input['team_id'] ?? 0);

if (!$teamId) {
    json_error('invalid_input', 422);
}

$pdo = db();

$stmt = $pdo->prepare('SELECT id, name, join_policy, auto_accept_join_requests FROM teams WHERE id = ?');
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

$stmt = $pdo->prepare('SELECT full_name FROM users WHERE id = ?');
$stmt->execute([$userId]);
$requesterName = (string) $stmt->fetchColumn();

if (!empty($team['auto_accept_join_requests'])) {
    $pdo->beginTransaction();
    try {
        // Recorded as already-resolved (never shows up as "pending" in the
        // Join requests panel — there's nothing for an admin to decide).
        $pdo->prepare('INSERT INTO join_requests (team_id, user_id, status, responded_at) VALUES (?, ?, "approved", NOW())')
            ->execute([$teamId, $userId]);
        $pdo->prepare('INSERT IGNORE INTO team_members (team_id, user_id, role, status) VALUES (?, ?, "employee", "active")')
            ->execute([$teamId, $userId]);
        create_notification($userId, 'join_auto_approved', $teamId, $team['name']);
        foreach (manager_user_ids_for_team($teamId) as $managerId) {
            create_notification($managerId, 'auto_joined', $teamId, $team['name'], $requesterName);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        json_error('join_failed', 500);
    }
    json_response(['ok' => true, 'auto_approved' => true]);
}

$pdo->prepare('INSERT INTO join_requests (team_id, user_id, status) VALUES (?, ?, "pending")')
    ->execute([$teamId, $userId]);

// Let every owner/admin of the team know someone's waiting on their decision.
foreach (manager_user_ids_for_team($teamId) as $managerId) {
    create_notification($managerId, 'join_request', $teamId, $team['name'], $requesterName);
}

json_response(['ok' => true, 'auto_approved' => false]);

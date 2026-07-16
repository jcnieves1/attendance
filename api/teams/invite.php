<?php
// Invite an existing user account to the team. Entirely in-app: no email is
// sent — the invited person sees this the next time they open the app and
// accepts or declines it themselves (see api/invitations/*.php).
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$input = read_json_body();
$teamId = (int) ($input['team_id'] ?? 0);
$invitedUserId = (int) ($input['user_id'] ?? 0);
$role = ($input['role'] ?? 'employee') === 'admin' ? 'admin' : 'employee';

if (!$teamId || !$invitedUserId) {
    json_error('invalid_input', 422, 'A team and a person to invite are required.');
}

require_manager($userId, $teamId);
$pdo = db();

$stmt = $pdo->prepare('SELECT id, full_name FROM users WHERE id = ?');
$stmt->execute([$invitedUserId]);
$invitedUser = $stmt->fetch();
if (!$invitedUser) {
    json_error('user_not_found', 404, 'That user account no longer exists.');
}

// Already an active member?
$stmt = $pdo->prepare('SELECT id FROM team_members WHERE team_id = ? AND user_id = ? AND status = "active"');
$stmt->execute([$teamId, $invitedUserId]);
if ($stmt->fetch()) {
    json_error('already_member', 409, 'That person is already in the team.');
}

// Already has a pending invite to this team?
$stmt = $pdo->prepare('SELECT id FROM invitations WHERE team_id = ? AND invited_user_id = ? AND status = "pending"');
$stmt->execute([$teamId, $invitedUserId]);
if ($stmt->fetch()) {
    json_error('already_invited', 409, 'That person already has a pending invitation to this team.');
}

$stmt = $pdo->prepare(
    'INSERT INTO invitations (team_id, invited_user_id, invited_by, role, status) VALUES (?, ?, ?, ?, "pending")'
);
$stmt->execute([$teamId, $invitedUserId, $userId, $role]);

json_response(['ok' => true, 'invited_user_id' => $invitedUserId, 'invited_name' => $invitedUser['full_name']]);

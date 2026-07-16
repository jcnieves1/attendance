<?php
// Lets a team's owner/admin reset a teammate's password — the fallback for
// when someone is locked out and either never set a security question or
// can't remember the answer. Deliberately can't be used on yourself (use
// the forgot-password flow or My account instead) or on the team owner
// (an admin resetting the owner's password would let them take over the
// owner's account, which defeats the point of "owner can't be demoted").
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$input = read_json_body();
$teamId = (int) ($input['team_id'] ?? 0);
$targetUserId = (int) ($input['user_id'] ?? 0);
$newPassword = (string) ($input['new_password'] ?? '');

if (!$teamId || !$targetUserId) {
    json_error('invalid_input', 422);
}
if (strlen($newPassword) < 8) {
    json_error('weak_password', 422, 'Password must be at least 8 characters.');
}

require_manager($userId, $teamId);

if ($targetUserId === $userId) {
    json_error('cannot_reset_self', 422, 'Use My account to change your own password.');
}

$stmt = db()->prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ? AND status = "active"');
$stmt->execute([$teamId, $targetUserId]);
$target = $stmt->fetch();

if (!$target) {
    json_error('not_a_member', 404, 'That person is not a member of this team.');
}
if ($target['role'] === 'owner') {
    json_error('cannot_reset_owner', 422, "The team owner's password can only be reset by the owner themselves.");
}

$hash = password_hash($newPassword, PASSWORD_DEFAULT);
db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([$hash, $targetUserId]);

json_response(['ok' => true]);

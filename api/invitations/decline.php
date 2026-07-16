<?php
// Decline a pending invitation — the logged-in user must be the invitee.
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$input = read_json_body();
$invitationId = (int) ($input['invitation_id'] ?? 0);

if (!$invitationId) {
    json_error('missing_invitation_id', 422);
}

$pdo = db();
$stmt = $pdo->prepare('SELECT * FROM invitations WHERE id = ? AND status = "pending"');
$stmt->execute([$invitationId]);
$invite = $stmt->fetch();

if (!$invite) {
    json_error('invite_not_found', 404, 'This invitation is no longer available.');
}
if ((int) $invite['invited_user_id'] !== $userId) {
    json_error('not_your_invite', 403, 'This invitation was not sent to you.');
}

$pdo->prepare('UPDATE invitations SET status = "declined", responded_at = NOW() WHERE id = ?')
    ->execute([$invite['id']]);

json_response(['ok' => true]);

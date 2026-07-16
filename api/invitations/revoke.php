<?php
// Let a manager/admin cancel a pending invitation they (or a co-admin) sent.
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

require_manager($userId, (int) $invite['team_id']);

$pdo->prepare('UPDATE invitations SET status = "revoked", responded_at = NOW() WHERE id = ?')
    ->execute([$invite['id']]);

json_response(['ok' => true]);

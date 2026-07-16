<?php
// Pending invitations a manager/admin has sent for their team, shown in the
// Admin area so they know who's been invited and can cancel if needed.
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$teamId = (int) ($_GET['team_id'] ?? 0);

if (!$teamId) {
    json_error('missing_team_id', 422);
}

require_manager($userId, $teamId);

$stmt = db()->prepare(
    'SELECT i.id, i.role, i.created_at, u.full_name, u.email
     FROM invitations i
     JOIN users u ON u.id = i.invited_user_id
     WHERE i.team_id = ? AND i.status = "pending"
     ORDER BY i.created_at DESC'
);
$stmt->execute([$teamId]);

json_response(['ok' => true, 'invitations' => $stmt->fetchAll()]);

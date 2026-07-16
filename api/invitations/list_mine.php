<?php
// Pending invitations for the logged-in user, to accept/decline in-app.
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();

$stmt = db()->prepare(
    'SELECT i.id, i.role, i.created_at, t.id AS team_id, t.name AS team_name, u.full_name AS invited_by_name
     FROM invitations i
     JOIN teams t ON t.id = i.team_id
     JOIN users u ON u.id = i.invited_by
     WHERE i.invited_user_id = ? AND i.status = "pending"
     ORDER BY i.created_at DESC'
);
$stmt->execute([$userId]);

json_response(['ok' => true, 'invitations' => $stmt->fetchAll()]);

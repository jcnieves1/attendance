<?php
// Lets a manager/admin search existing user accounts to invite to their
// team. Only returns people who aren't already an active member and don't
// already have a pending invitation to this team.
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$teamId = (int) ($_GET['team_id'] ?? 0);
$query = trim($_GET['q'] ?? '');

if (!$teamId) {
    json_error('missing_team_id', 422);
}

require_manager($userId, $teamId);

$sql = 'SELECT id, full_name, email FROM users
        WHERE id NOT IN (SELECT user_id FROM team_members WHERE team_id = ? AND status = "active")
          AND id NOT IN (SELECT invited_user_id FROM invitations WHERE team_id = ? AND status = "pending")';
$params = [$teamId, $teamId];

if ($query !== '') {
    $sql .= ' AND (full_name LIKE ? OR email LIKE ?)';
    $like = '%' . $query . '%';
    $params[] = $like;
    $params[] = $like;
}

$sql .= ' ORDER BY full_name LIMIT 20';

$stmt = db()->prepare($sql);
$stmt->execute($params);

json_response(['ok' => true, 'users' => $stmt->fetchAll()]);

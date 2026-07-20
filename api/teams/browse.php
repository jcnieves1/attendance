<?php
// "Find a team" — lists teams tagged join_policy='open' that the caller
// isn't already an active member of, optionally filtered by a name search.
// Each row also says whether the caller already has a pending join request
// to that team, so the UI can show "Requested" instead of a clickable button.
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$query = trim($_GET['q'] ?? '');

$sql = "SELECT t.id, t.name, t.description,
               (SELECT COUNT(*) FROM team_members m2 WHERE m2.team_id = t.id AND m2.status = 'active') AS member_count,
               EXISTS(
                   SELECT 1 FROM join_requests jr
                   WHERE jr.team_id = t.id AND jr.user_id = ? AND jr.status = 'pending'
               ) AS has_pending_request
        FROM teams t
        WHERE t.join_policy = 'open'
          AND t.id NOT IN (SELECT team_id FROM team_members WHERE user_id = ? AND status = 'active')";
$params = [$userId, $userId];

if ($query !== '') {
    $sql .= ' AND t.name LIKE ?';
    $params[] = '%' . $query . '%';
}

$sql .= ' ORDER BY t.name LIMIT 30';

$stmt = db()->prepare($sql);
$stmt->execute($params);
$teams = $stmt->fetchAll();
foreach ($teams as &$row) {
    $row['has_pending_request'] = (bool) $row['has_pending_request'];
}

json_response(['ok' => true, 'teams' => $teams]);

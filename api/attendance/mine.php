<?php
// The logged-in user's own attendance, optionally filtered to one team.
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$teamId = (int) ($_GET['team_id'] ?? 0);
$from = trim($_GET['from'] ?? '1970-01-01');
$to = trim($_GET['to'] ?? '2999-12-31');

$sql = 'SELECT team_id, attendance_date, checked_in_at FROM attendance WHERE user_id = ? AND attendance_date BETWEEN ? AND ?';
$params = [$userId, $from, $to];

if ($teamId) {
    require_member($userId, $teamId);
    $sql .= ' AND team_id = ?';
    $params[] = $teamId;
}

$sql .= ' ORDER BY attendance_date';

$stmt = db()->prepare($sql);
$stmt->execute($params);

json_response(['ok' => true, 'attendance' => $stmt->fetchAll()]);

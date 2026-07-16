<?php
// The logged-in employee's own attendance for their personal dashboard,
// across all their teams (or one team if team_id is given). Scoped to a
// year, and optionally narrowed further to a single month within that year.
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$teamId = (int) ($_GET['team_id'] ?? 0);
$year = (int) ($_GET['year'] ?? date('Y'));
$month = isset($_GET['month']) && $_GET['month'] !== '' ? (int) $_GET['month'] : null;

if ($month !== null && ($month < 1 || $month > 12)) {
    json_error('invalid_month', 422);
}

if ($month) {
    $from = sprintf('%04d-%02d-01', $year, $month);
    $to = date('Y-m-t', strtotime($from));
} else {
    $from = "$year-01-01";
    $to = "$year-12-31";
}

$sql = 'SELECT team_id, attendance_date FROM attendance WHERE user_id = ? AND attendance_date BETWEEN ? AND ?';
$params = [$userId, $from, $to];

if ($teamId) {
    require_member($userId, $teamId);
    $sql .= ' AND team_id = ?';
    $params[] = $teamId;
}

$stmt = db()->prepare($sql . ' ORDER BY attendance_date');
$stmt->execute($params);

json_response(['ok' => true, 'year' => $year, 'month' => $month, 'attendance' => $stmt->fetchAll()]);

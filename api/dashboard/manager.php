<?php
// Attendance data for a team, used to render the manager's heatmap and
// per-person totals. Scoped to a year, and optionally narrowed further to a
// single month within that year. Returns raw rows; the frontend aggregates
// them.
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$teamId = (int) ($_GET['team_id'] ?? 0);
$year = (int) ($_GET['year'] ?? date('Y'));
$month = isset($_GET['month']) && $_GET['month'] !== '' ? (int) $_GET['month'] : null;

if (!$teamId) {
    json_error('missing_team_id', 422);
}
if ($month !== null && ($month < 1 || $month > 12)) {
    json_error('invalid_month', 422);
}
require_manager($userId, $teamId);

if ($month) {
    $from = sprintf('%04d-%02d-01', $year, $month);
    $to = date('Y-m-t', strtotime($from));
} else {
    $from = "$year-01-01";
    $to = "$year-12-31";
}

$stmt = db()->prepare(
    'SELECT a.user_id, u.full_name, u.avatar_filename, a.attendance_date
     FROM attendance a JOIN users u ON u.id = a.user_id
     WHERE a.team_id = ? AND a.attendance_date BETWEEN ? AND ?
     ORDER BY a.attendance_date'
);
$stmt->execute([$teamId, $from, $to]);
$rows = $stmt->fetchAll();

$stmt = db()->prepare(
    'SELECT u.id, u.full_name, u.avatar_filename FROM team_members tm JOIN users u ON u.id = tm.user_id
     WHERE tm.team_id = ? AND tm.status = "active" ORDER BY u.full_name'
);
$stmt->execute([$teamId]);
$members = $stmt->fetchAll();

json_response([
    'ok' => true,
    'year' => $year,
    'month' => $month,
    'members' => $members,
    'attendance' => $rows,
]);

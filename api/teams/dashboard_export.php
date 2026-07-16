<?php
// Lets a team's owner/admin download the attendance dashboard as an Excel
// file, honoring the same year (and optional month) filter currently
// applied in the Admin area's dashboard view. GET so it can be a plain
// browser download link (with the session cookie sent along automatically).
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../xlsx_helper.php';

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

$pdo = db();

$stmt = $pdo->prepare('SELECT name FROM teams WHERE id = ?');
$stmt->execute([$teamId]);
$teamName = (string) $stmt->fetchColumn();

$stmt = $pdo->prepare(
    'SELECT a.attendance_date, u.full_name, u.email, a.checked_in_at
     FROM attendance a JOIN users u ON u.id = a.user_id
     WHERE a.team_id = ? AND a.attendance_date BETWEEN ? AND ?
     ORDER BY a.attendance_date, u.full_name'
);
$stmt->execute([$teamId, $from, $to]);
$rows = $stmt->fetchAll();

$header = ['Date', 'Employee', 'Email', 'Checked in at'];
$exportRows = array_map(static function (array $r): array {
    return [$r['attendance_date'], $r['full_name'], $r['email'], $r['checked_in_at']];
}, $rows);

$rangeLabel = $month ? sprintf('%04d-%02d', $year, $month) : (string) $year;
$safeTeamName = (string) preg_replace('/[^a-zA-Z0-9_-]+/', '_', $teamName);
$safeTeamName = $safeTeamName !== '' ? $safeTeamName : 'team';
$filename = "officepal_{$safeTeamName}_attendance_{$rangeLabel}.xlsx";

send_xlsx_download($filename, 'Attendance', $header, $exportRows);

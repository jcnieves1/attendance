<?php
// Attendance for every member of a team within a date range (used for the
// weekly view and the manager's yearly dashboard/heatmap).
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$teamId = (int) ($_GET['team_id'] ?? 0);
$from = trim($_GET['from'] ?? '');
$to = trim($_GET['to'] ?? '');

if (!$teamId || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $from) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)) {
    json_error('invalid_input', 422);
}

require_member($userId, $teamId);

$stmt = db()->prepare(
    'SELECT a.user_id, u.full_name, u.avatar_filename, a.attendance_date, a.checked_in_at
     FROM attendance a JOIN users u ON u.id = a.user_id
     WHERE a.team_id = ? AND a.attendance_date BETWEEN ? AND ?
     ORDER BY a.attendance_date, u.full_name'
);
$stmt->execute([$teamId, $from, $to]);

json_response(['ok' => true, 'attendance' => $stmt->fetchAll()]);

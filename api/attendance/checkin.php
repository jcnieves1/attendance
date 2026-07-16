<?php
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$input = read_json_body();
$teamId = (int) ($input['team_id'] ?? 0);
$date = trim($input['date'] ?? date('Y-m-d'));

if (!$teamId || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    json_error('invalid_input', 422);
}

require_member($userId, $teamId);
$pdo = db();

$stmt = $pdo->prepare(
    'INSERT INTO attendance (user_id, team_id, attendance_date)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE checked_in_at = checked_in_at'
);
$stmt->execute([$userId, $teamId, $date]);

json_response(['ok' => true]);

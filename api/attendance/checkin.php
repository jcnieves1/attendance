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

// A future date is only allowed if the team's manager has explicitly turned
// that on (Admin area -> "Days tracked" -> "Allow future check-ins"). This
// is the actual enforcement — the frontend just avoids offering the click
// in the first place, but that's only a convenience; this check is what
// actually prevents it, even if someone calls the API directly.
if ($date > date('Y-m-d')) {
    $stmt = $pdo->prepare('SELECT allow_future_checkin FROM teams WHERE id = ?');
    $stmt->execute([$teamId]);
    if (!$stmt->fetchColumn()) {
        json_error('future_checkin_disabled', 422, "This team doesn't allow checking in for a future date.");
    }
}

$stmt = $pdo->prepare(
    'INSERT INTO attendance (user_id, team_id, attendance_date)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE checked_in_at = checked_in_at'
);
$stmt->execute([$userId, $teamId, $date]);

json_response(['ok' => true]);

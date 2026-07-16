<?php
// Let an employee undo an accidental check-in for a given date.
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$input = read_json_body();
$teamId = (int) ($input['team_id'] ?? 0);
$date = trim($input['date'] ?? '');

if (!$teamId || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    json_error('invalid_input', 422);
}

require_member($userId, $teamId);

db()->prepare('DELETE FROM attendance WHERE user_id = ? AND team_id = ? AND attendance_date = ?')
    ->execute([$userId, $teamId, $date]);

json_response(['ok' => true]);

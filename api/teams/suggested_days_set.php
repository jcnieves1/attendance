<?php
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$input = read_json_body();
$teamId = (int) ($input['team_id'] ?? 0);
$days = $input['days'] ?? null; // array of ints 0..6

if (!$teamId || !is_array($days)) {
    json_error('invalid_input', 422);
}

require_manager($userId, $teamId);

$maxDay = max_day_index_for_team($teamId);
$days = array_values(array_unique(array_map('intval', $days)));
foreach ($days as $d) {
    if ($d < 0 || $d > $maxDay) {
        json_error('invalid_day', 422, 'That day is not tracked by this team.');
    }
}

$pdo = db();
$pdo->beginTransaction();
try {
    $pdo->prepare('DELETE FROM suggested_days WHERE team_id = ?')->execute([$teamId]);
    $stmt = $pdo->prepare('INSERT INTO suggested_days (team_id, day_of_week, set_by) VALUES (?, ?, ?)');
    foreach ($days as $d) {
        $stmt->execute([$teamId, $d, $userId]);
    }
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    json_error('update_failed', 500);
}

json_response(['ok' => true, 'days' => $days]);

<?php
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$input = read_json_body();
$name = trim($input['name'] ?? '');
$description = trim($input['description'] ?? '');

if ($name === '') {
    json_error('missing_name', 422, 'Please give your team a name.');
}

$pdo = db();
$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare('INSERT INTO teams (name, description, owner_id) VALUES (?, ?, ?)');
    $stmt->execute([$name, $description ?: null, $userId]);
    $teamId = (int) $pdo->lastInsertId();

    $pdo->prepare('INSERT INTO team_members (team_id, user_id, role, status) VALUES (?, ?, "owner", "active")')
        ->execute([$teamId, $userId]);

    // Sensible default: suggest every weekday until the manager changes it.
    $stmt = $pdo->prepare('INSERT INTO suggested_days (team_id, day_of_week, set_by) VALUES (?, ?, ?)');
    foreach ([0, 1, 2, 3, 4] as $day) {
        $stmt->execute([$teamId, $day, $userId]);
    }

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    json_error('create_failed', 500, 'Could not create the team.');
}

json_response(['ok' => true, 'team_id' => $teamId]);

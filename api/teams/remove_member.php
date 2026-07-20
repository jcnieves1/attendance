<?php
// Removes a member from the team. This is destructive and irreversible on
// purpose (the UI warns about this before calling in): it also permanently
// deletes that person's attendance history for this team, and queues a
// notification so they find out from their 🔔 bell.
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$input = read_json_body();
$teamId = (int) ($input['team_id'] ?? 0);
$targetUserId = (int) ($input['user_id'] ?? 0);

if (!$teamId || !$targetUserId) {
    json_error('invalid_input', 422);
}

require_manager($userId, $teamId);

$pdo = db();

$stmt = $pdo->prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?');
$stmt->execute([$teamId, $targetUserId]);
$target = $stmt->fetch();
if ($target && $target['role'] === 'owner') {
    json_error('cannot_remove_owner', 422, 'The team owner cannot be removed.');
}

$stmt = $pdo->prepare('SELECT name FROM teams WHERE id = ?');
$stmt->execute([$teamId]);
$teamName = (string) $stmt->fetchColumn();

$pdo->beginTransaction();
try {
    $pdo->prepare('DELETE FROM attendance WHERE team_id = ? AND user_id = ?')->execute([$teamId, $targetUserId]);
    $pdo->prepare('DELETE FROM team_members WHERE team_id = ? AND user_id = ?')->execute([$teamId, $targetUserId]);
    create_notification($targetUserId, 'removed_from_team', $teamId, $teamName);
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    json_error('remove_failed', 500);
}

json_response(['ok' => true]);

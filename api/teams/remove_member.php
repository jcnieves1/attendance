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

    // If this was the removed person's default (auto-selected-on-login)
    // team, it can't stay pointed at a team they're no longer in — fall back
    // to another team they still belong to, or clear it if none are left.
    $stmt = $pdo->prepare('SELECT default_team_id FROM users WHERE id = ?');
    $stmt->execute([$targetUserId]);
    $targetDefaultTeamId = (int) $stmt->fetchColumn();
    if ($targetDefaultTeamId === $teamId) {
        $stmt = $pdo->prepare(
            'SELECT team_id FROM team_members WHERE user_id = ? AND status = "active" ORDER BY joined_at ASC LIMIT 1'
        );
        $stmt->execute([$targetUserId]);
        $newDefaultTeamId = $stmt->fetchColumn();
        $pdo->prepare('UPDATE users SET default_team_id = ? WHERE id = ?')
            ->execute([$newDefaultTeamId ?: null, $targetUserId]);
    }

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    json_error('remove_failed', 500);
}

json_response(['ok' => true]);

<?php
// A manager/admin drags a message to a new position on the "Messages
// board" — the frontend sends the full new order for the team's messages
// (an array of message ids) after every drop, and this rewrites sort_order
// for all of them to match.
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$input = read_json_body();
$teamId = (int) ($input['team_id'] ?? 0);
$orderedIds = $input['ordered_ids'] ?? null;

if (!$teamId || !is_array($orderedIds) || empty($orderedIds)) {
    json_error('invalid_input', 422);
}

require_manager($userId, $teamId);

$orderedIds = array_map('intval', $orderedIds);

$pdo = db();

// The submitted id list must be exactly this team's current messages (same
// set, any order) — otherwise a crafted request could smuggle in ids from
// another team, or silently drop one without the UI noticing.
$stmt = $pdo->prepare('SELECT id FROM team_messages WHERE team_id = ?');
$stmt->execute([$teamId]);
$validIds = array_map('intval', array_column($stmt->fetchAll(), 'id'));

$sortedValid = $validIds;
sort($sortedValid);
$sortedSubmitted = $orderedIds;
sort($sortedSubmitted);
if ($sortedValid !== $sortedSubmitted) {
    json_error('stale_message_list', 409, 'The message list changed — please refresh and try again.');
}

$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare('UPDATE team_messages SET sort_order = ? WHERE id = ? AND team_id = ?');
    foreach ($orderedIds as $index => $id) {
        $stmt->execute([$index, $id, $teamId]);
    }
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    json_error('reorder_failed', 500);
}

json_response(['ok' => true]);

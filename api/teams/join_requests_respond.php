<?php
// A manager/admin accepts or rejects a pending join request. Accepting always
// adds the person as an 'employee' — never as an admin — matching how
// invited members are role-assigned; the owner/admin can promote them
// afterwards from the Members list if they choose to.
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$input = read_json_body();
$requestId = (int) ($input['request_id'] ?? 0);
$action = $input['action'] ?? '';

if (!$requestId || !in_array($action, ['approve', 'reject'], true)) {
    json_error('invalid_input', 422);
}

$pdo = db();
$stmt = $pdo->prepare('SELECT * FROM join_requests WHERE id = ? AND status = "pending"');
$stmt->execute([$requestId]);
$request = $stmt->fetch();
if (!$request) {
    json_error('request_not_found', 404, 'This join request is no longer available.');
}

require_manager($userId, (int) $request['team_id']);

$stmt = $pdo->prepare('SELECT name FROM teams WHERE id = ?');
$stmt->execute([$request['team_id']]);
$teamName = (string) $stmt->fetchColumn();

$stmt = $pdo->prepare('SELECT full_name, email FROM users WHERE id = ?');
$stmt->execute([$userId]);
$responder = $stmt->fetch();

$pdo->beginTransaction();
try {
    if ($action === 'approve') {
        $pdo->prepare('INSERT IGNORE INTO team_members (team_id, user_id, role, status) VALUES (?, ?, "employee", "active")')
            ->execute([$request['team_id'], $request['user_id']]);
        $pdo->prepare('UPDATE join_requests SET status = "approved", responded_at = NOW() WHERE id = ?')
            ->execute([$requestId]);
        // Cheerful welcome, naming who approved it.
        create_notification($request['user_id'], 'join_request_approved', (int) $request['team_id'], $teamName, $responder['full_name']);
    } else {
        $pdo->prepare('UPDATE join_requests SET status = "rejected", responded_at = NOW() WHERE id = ?')
            ->execute([$requestId]);
        // Apologetic note, naming who rejected it and how to reach them.
        create_notification($request['user_id'], 'join_request_rejected', (int) $request['team_id'], $teamName, $responder['full_name'], $responder['email']);
    }
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    json_error('respond_failed', 500);
}

json_response(['ok' => true]);

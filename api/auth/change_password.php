<?php
// Logged-in user changes their own password, given their current one.
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$input = read_json_body();
$currentPassword = (string) ($input['current_password'] ?? '');
$newPassword = (string) ($input['new_password'] ?? '');

if (strlen($newPassword) < 8) {
    json_error('weak_password', 422, 'Password must be at least 8 characters.');
}

$stmt = db()->prepare('SELECT password_hash FROM users WHERE id = ?');
$stmt->execute([$userId]);
$hash = $stmt->fetchColumn();

if (!$hash || !password_verify($currentPassword, $hash)) {
    json_error('invalid_current_password', 401, 'Your current password is incorrect.');
}

$newHash = password_hash($newPassword, PASSWORD_DEFAULT);
db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([$newHash, $userId]);

json_response(['ok' => true]);

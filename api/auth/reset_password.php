<?php
// Step 2 of the "forgot password" flow: verifies the security-question
// answer and, if correct, sets a new password. No session/login required —
// this is how a locked-out user gets back in.
require_once __DIR__ . '/../helpers.php';

$input = read_json_body();
$email = strtolower(trim($input['email'] ?? ''));
$answer = trim($input['security_answer'] ?? '');
$newPassword = (string) ($input['new_password'] ?? '');

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $answer === '') {
    json_error('invalid_input', 422);
}
if (strlen($newPassword) < 8) {
    json_error('weak_password', 422, 'Password must be at least 8 characters.');
}

$stmt = db()->prepare('SELECT id, security_answer_hash FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !$user['security_answer_hash'] || !password_verify(normalize_security_answer($answer), $user['security_answer_hash'])) {
    json_error('invalid_answer', 401, "That answer doesn't match. Ask a manager or admin of one of your teams to reset your password instead.");
}

$hash = password_hash($newPassword, PASSWORD_DEFAULT);
db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([$hash, $user['id']]);

json_response(['ok' => true]);

<?php
// Logging in now goes through two extra guards, both aimed at scripted /
// bulk brute-force attempts rather than a real person mistyping a password:
//   1. A per-email rate limit — 5+ failed attempts in the last 15 minutes
//      blocks further tries with a 429, regardless of whether this attempt's
//      credentials or CAPTCHA are even correct.
//   2. A math CAPTCHA (see api/auth/captcha.php + api/helpers.php) that must
//      be solved fresh on every single attempt — the answer is single-use
//      and expires after 10 minutes, so it can't be replayed by a script.
require_once __DIR__ . '/../helpers.php';
start_session();

$input = read_json_body();
$email = strtolower(trim($input['email'] ?? ''));
$password = (string) ($input['password'] ?? '');
$captchaAnswer = $input['captcha_answer'] ?? null;

if ($email === '' || $password === '') {
    json_error('invalid_credentials', 401, 'Email or password is incorrect.');
}

$pdo = db();
$ip = $_SERVER['REMOTE_ADDR'] ?? null;

$stmt = $pdo->prepare(
    "SELECT COUNT(*) FROM login_attempts
     WHERE email = ? AND success = 0 AND created_at > (NOW() - INTERVAL 15 MINUTE)"
);
$stmt->execute([$email]);
if ((int) $stmt->fetchColumn() >= 5) {
    json_error('too_many_attempts', 429, 'Too many failed login attempts. Please wait a few minutes and try again.');
}

if (!verify_captcha_answer($captchaAnswer)) {
    json_error('captcha_incorrect', 422, "That wasn't quite right — please solve the new security check below.");
}

$stmt = $pdo->prepare('SELECT id, password_hash FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    $pdo->prepare('INSERT INTO login_attempts (email, ip_address, success) VALUES (?, ?, 0)')->execute([$email, $ip]);
    json_error('invalid_credentials', 401, 'Email or password is incorrect.');
}

$pdo->prepare('INSERT INTO login_attempts (email, ip_address, success) VALUES (?, ?, 1)')->execute([$email, $ip]);

$_SESSION['user_id'] = (int) $user['id'];
json_response(['ok' => true, 'user_id' => (int) $user['id']]);

<?php
require_once __DIR__ . '/../helpers.php';
start_session();

$input = read_json_body();
$email = strtolower(trim($input['email'] ?? ''));
$password = (string) ($input['password'] ?? '');

$stmt = db()->prepare('SELECT id, password_hash FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    json_error('invalid_credentials', 401, 'Email or password is incorrect.');
}

$_SESSION['user_id'] = (int) $user['id'];
json_response(['ok' => true, 'user_id' => (int) $user['id']]);

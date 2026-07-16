<?php
require_once __DIR__ . '/../helpers.php';
start_session();

$input = read_json_body();
$email = strtolower(trim($input['email'] ?? ''));
$password = (string) ($input['password'] ?? '');
$fullName = trim($input['full_name'] ?? '');
$language = ($input['language'] ?? 'en') === 'es' ? 'es' : 'en';
$securityQuestion = trim($input['security_question'] ?? '');
$securityAnswer = trim($input['security_answer'] ?? '');

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_error('invalid_email', 422, 'Please enter a valid email address.');
}
if (strlen($password) < 8) {
    json_error('weak_password', 422, 'Password must be at least 8 characters.');
}
if ($fullName === '') {
    json_error('missing_name', 422, 'Please tell us your real name so your managers know who you are.');
}
// The security question is optional, but if either half is filled in, both
// must be — a question with no answer (or vice versa) is useless.
if (($securityQuestion === '') !== ($securityAnswer === '')) {
    json_error('incomplete_security_question', 422, 'Please fill in both the security question and its answer, or leave both blank.');
}

$pdo = db();

$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    json_error('email_taken', 409, 'An account with that email already exists. Try logging in instead.');
}

$hash = password_hash($password, PASSWORD_DEFAULT);
$securityAnswerHash = $securityAnswer !== '' ? password_hash(normalize_security_answer($securityAnswer), PASSWORD_DEFAULT) : null;

$stmt = $pdo->prepare(
    'INSERT INTO users (email, password_hash, full_name, language, security_question, security_answer_hash)
     VALUES (?, ?, ?, ?, ?, ?)'
);
$stmt->execute([
    $email,
    $hash,
    $fullName,
    $language,
    $securityQuestion !== '' ? $securityQuestion : null,
    $securityAnswerHash,
]);
$userId = (int) $pdo->lastInsertId();

$_SESSION['user_id'] = $userId;

json_response(['ok' => true, 'user_id' => $userId]);

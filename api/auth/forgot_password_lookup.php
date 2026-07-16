<?php
// Step 1 of the "forgot password" flow: given an email, tells the login
// screen whether there's a security question to ask. Deliberately doesn't
// say whether the email itself has an account (to avoid confirming/denying
// that in a way strangers could poke at) — if there's no question to ask,
// the frontend just points the user at a manager/admin for help instead.
require_once __DIR__ . '/../helpers.php';

$email = strtolower(trim($_GET['email'] ?? ''));

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_error('invalid_email', 422, 'Please enter a valid email address.');
}

$stmt = db()->prepare('SELECT security_question FROM users WHERE email = ?');
$stmt->execute([$email]);
$question = $stmt->fetchColumn();

json_response([
    'ok'          => true,
    'has_question' => $question !== false && $question !== null && $question !== '',
    'question'    => $question ?: null,
]);

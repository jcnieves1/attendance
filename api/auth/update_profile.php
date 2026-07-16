<?php
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$input = read_json_body();

$fields = [];
$values = [];

if (isset($input['language']) && in_array($input['language'], ['en', 'es'], true)) {
    $fields[] = 'language = ?';
    $values[] = $input['language'];
}
if (isset($input['theme']) && in_array($input['theme'], ['sunrise', 'forest', 'midnight'], true)) {
    $fields[] = 'theme = ?';
    $values[] = $input['theme'];
}
if (isset($input['full_name']) && trim($input['full_name']) !== '') {
    $fields[] = 'full_name = ?';
    $values[] = trim($input['full_name']);
}
if (isset($input['security_question']) || isset($input['security_answer'])) {
    $question = trim($input['security_question'] ?? '');
    $answer = trim($input['security_answer'] ?? '');
    if ($question === '' || $answer === '') {
        json_error('incomplete_security_question', 422, 'Please fill in both the security question and its answer.');
    }
    $fields[] = 'security_question = ?';
    $values[] = $question;
    $fields[] = 'security_answer_hash = ?';
    $values[] = password_hash(normalize_security_answer($answer), PASSWORD_DEFAULT);
}

if (empty($fields)) {
    json_error('nothing_to_update', 422, 'No valid fields provided.');
}

$values[] = $userId;
db()->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);

json_response(['ok' => true]);

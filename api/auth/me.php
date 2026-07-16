<?php
require_once __DIR__ . '/../helpers.php';

$user = current_user();
if (!$user) {
    json_response(['ok' => true, 'user' => null]);
}
json_response(['ok' => true, 'user' => $user]);

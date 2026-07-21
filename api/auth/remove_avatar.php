<?php
// Removes the caller's own profile picture — clears it from their user
// record and deletes the actual file from the server, so no orphaned
// avatars pile up over time.
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$pdo = db();

$stmt = $pdo->prepare('SELECT avatar_filename FROM users WHERE id = ?');
$stmt->execute([$userId]);
$filename = $stmt->fetchColumn();

if ($filename) {
    $pdo->prepare('UPDATE users SET avatar_filename = NULL WHERE id = ?')->execute([$userId]);
    delete_avatar_file($filename);
}

json_response(['ok' => true]);

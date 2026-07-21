<?php
// Uploads the caller's profile picture. The raw upload is validated (real
// image, sane pixel dimensions, size ceiling), then process_avatar_upload()
// center-crops it to a square, downsizes it to a small fixed resolution, and
// re-encodes it as a quality-reduced JPEG — so every stored avatar is small
// and uniform regardless of what was originally uploaded. Replaces (and
// deletes from disk) any previous avatar for this user.
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();

if (empty($_FILES['avatar']) || !is_uploaded_file($_FILES['avatar']['tmp_name'] ?? '')) {
    json_error('no_file', 422, 'Please choose an image to upload.');
}

$file = $_FILES['avatar'];
if ($file['error'] !== UPLOAD_ERR_OK) {
    json_error('upload_failed', 422, 'That upload did not go through. Please try again.');
}

// 5 MB ceiling on the *original* upload — plenty for any phone photo, but
// keeps someone from pushing something enormous at the resizer.
if ($file['size'] > 5 * 1024 * 1024) {
    json_error('file_too_large', 422, 'That image is too large (5 MB max).');
}

try {
    $filename = process_avatar_upload($file['tmp_name']);
} catch (RuntimeException $e) {
    json_error('invalid_image', 422, $e->getMessage());
}

$pdo = db();
$stmt = $pdo->prepare('SELECT avatar_filename FROM users WHERE id = ?');
$stmt->execute([$userId]);
$old = $stmt->fetchColumn();

$pdo->prepare('UPDATE users SET avatar_filename = ? WHERE id = ?')->execute([$filename, $userId]);

// Only delete the old file once the new one is safely saved and recorded.
if ($old) {
    delete_avatar_file($old);
}

json_response(['ok' => true, 'avatar_filename' => $filename, 'avatar_url' => avatar_url($filename)]);

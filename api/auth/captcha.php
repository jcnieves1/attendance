<?php
// Issues a fresh math CAPTCHA challenge for the login page — called before
// the person is authenticated, so no auth required. The frontend renders
// this as "What is {a} + {b}?"; the expected sum never leaves the server.
require_once __DIR__ . '/../helpers.php';

json_response(array_merge(['ok' => true], generate_captcha_challenge()));

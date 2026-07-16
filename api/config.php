<?php
/**
 * OfficePal configuration.
 *
 * All values can be overridden with environment variables so you never have
 * to hard-code secrets in source control. For quick local development you
 * can also just edit the fallback values below.
 */

function env_or(string $name, string $default): string
{
    $value = getenv($name);
    return ($value === false || $value === '') ? $default : $value;
}

return [
    // --- MySQL connection -------------------------------------------------
    'db' => [
        'host'     => env_or('OFFICEPAL_DB_HOST', '127.0.0.1'),
        'port'     => env_or('OFFICEPAL_DB_PORT', '3306'),
        'name'     => env_or('OFFICEPAL_DB_NAME', 'juanca44_attendance'),
        'user'     => env_or('OFFICEPAL_DB_USER', 'juanca44_attendance_user'),
        'password' => env_or('OFFICEPAL_DB_PASS', 'Michael1Scott'),
    ],

    // --- App -----------------------------------------------------------------
    'app' => [
        // Reserved for future use (e.g. building absolute links). The app no
        // longer emails anything, so this isn't required for invitations —
        // those are accepted entirely in-app now.
        'base_url' => env_or('OFFICEPAL_BASE_URL', 'http://localhost:8000'),
    ],
];

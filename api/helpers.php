<?php
/**
 * Shared request/response/session helpers used by every API endpoint.
 */

require_once __DIR__ . '/db.php';

function start_session(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params([
            'lifetime' => 60 * 60 * 24 * 30,
            'path'     => '/',
            'samesite' => 'Lax',
        ]);
        session_start();
    }
}

function json_response($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function json_error(string $error, int $status = 400, string $message = ''): void
{
    json_response([
        'ok'      => false,
        'error'   => $error,
        'message' => $message ?: $error,
    ], $status);
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function current_user_id(): ?int
{
    start_session();
    return $_SESSION['user_id'] ?? null;
}

function require_auth(): int
{
    $userId = current_user_id();
    if (!$userId) {
        json_error('not_authenticated', 401, 'Please log in.');
    }
    return $userId;
}

function current_user(): ?array
{
    $userId = current_user_id();
    if (!$userId) {
        return null;
    }
    $stmt = db()->prepare('SELECT id, email, full_name, language, theme, security_question, created_at FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    return $user ?: null;
}

/**
 * Normalizes a security-question answer before hashing/comparing it, so
 * capitalization and stray whitespace don't cause an otherwise-correct
 * answer to fail the check.
 */
function normalize_security_answer(string $answer): string
{
    // Plain strtolower(), not mb_strtolower() — mbstring isn't a guaranteed
    // extension on every PHP install, and OfficePal otherwise only requires
    // pdo_mysql. Good enough for case-folding simple answers; if accents
    // trip someone up, a manager/admin can always reset their password.
    return strtolower(trim($answer));
}

/**
 * Fetch the caller's membership row for a team, or null if not a member.
 */
function membership_for(int $userId, int $teamId): ?array
{
    $stmt = db()->prepare('SELECT * FROM team_members WHERE team_id = ? AND user_id = ? AND status = "active"');
    $stmt->execute([$teamId, $userId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

/**
 * Require the caller to be an active member of the team, any role.
 */
function require_member(int $userId, int $teamId): array
{
    $membership = membership_for($userId, $teamId);
    if (!$membership) {
        json_error('not_a_member', 403, 'You are not a member of this team.');
    }
    return $membership;
}

/**
 * Require the caller to be the owner or an admin (i.e. can manage the team).
 */
function require_manager(int $userId, int $teamId): array
{
    $membership = require_member($userId, $teamId);
    if (!in_array($membership['role'], ['owner', 'admin'], true)) {
        json_error('not_authorized', 403, 'Only the team manager or admins can do this.');
    }
    return $membership;
}

function require_owner(int $userId, int $teamId): array
{
    $membership = require_member($userId, $teamId);
    if ($membership['role'] !== 'owner') {
        json_error('not_authorized', 403, 'Only the team owner can do this.');
    }
    return $membership;
}

/**
 * Highest allowed day_of_week index (0=Mon..6=Sun) for a team's suggested /
 * favorite days, based on whether it tracks weekends. Returns 4 (Fri) for
 * weekdays-only teams, 6 (Sun) for teams that track the full week.
 */
function max_day_index_for_team(int $teamId): int
{
    $stmt = db()->prepare('SELECT track_weekends FROM teams WHERE id = ?');
    $stmt->execute([$teamId]);
    $trackWeekends = (bool) $stmt->fetchColumn();
    return $trackWeekends ? 6 : 4;
}

/** ISO Monday=0..Sunday=6 day index for a Y-m-d date string. */
function day_of_week_index(string $ymd): int
{
    $n = (int) (new DateTime($ymd))->format('N'); // 1 (Mon) .. 7 (Sun)
    return $n - 1;
}

/** Monday date (Y-m-d) of the week containing $ymd (defaults to today). */
function week_start(?string $ymd = null): string
{
    $date = $ymd ? new DateTime($ymd) : new DateTime();
    $dow = (int) $date->format('N'); // 1..7
    $date->modify('-' . ($dow - 1) . ' days');
    return $date->format('Y-m-d');
}

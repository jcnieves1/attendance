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
    $stmt = db()->prepare('SELECT id, email, full_name, language, theme, default_team_id, security_question, created_at FROM users WHERE id = ?');
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

/**
 * Queues a 🔔-bell notification for a user. team_name/actor_name/actor_email
 * are stored as plain-text snapshots (not live joins) so the notification
 * still reads sensibly even if the team or the other person's account
 * changes later. actor_email is only really used by join_request_rejected
 * (so the person knows who to contact), but is accepted generally.
 */
function create_notification(int $userId, string $type, ?int $teamId, string $teamName, ?string $actorName = null, ?string $actorEmail = null): void
{
    db()->prepare(
        'INSERT INTO notifications (user_id, type, team_id, team_name, actor_name, actor_email) VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([$userId, $type, $teamId, $teamName, $actorName, $actorEmail]);
}

/** Active owner/admin user IDs for a team — the people who manage it. */
function manager_user_ids_for_team(int $teamId): array
{
    $stmt = db()->prepare(
        "SELECT user_id FROM team_members WHERE team_id = ? AND status = 'active' AND role IN ('owner', 'admin')"
    );
    $stmt->execute([$teamId]);
    return array_map('intval', array_column($stmt->fetchAll(), 'user_id'));
}

/**
 * Generates a small arithmetic challenge for the login page — a lightweight
 * CAPTCHA meant to slow down scripted/bulk login attempts without requiring
 * any third-party service or API key. The expected answer is stashed
 * server-side in the session only; the client only ever sees the two
 * numbers to add. Returns ['a' => int, 'b' => int] for the frontend to
 * render as a localized "What is {a} + {b}?" question.
 */
function generate_captcha_challenge(): array
{
    start_session();
    $a = random_int(1, 10);
    $b = random_int(1, 10);
    $_SESSION['captcha_answer'] = $a + $b;
    $_SESSION['captcha_generated_at'] = time();
    return ['a' => $a, 'b' => $b];
}

/**
 * Whitelist-based HTML sanitizer for the Admin area's "Messages board" rich
 * text. Built on PHP's DOMDocument rather than a raw regex/strip_tags pass —
 * regex-based HTML sanitization is notoriously easy to bypass (nested tags,
 * malformed markup, odd attribute encoding, etc). Anything not on the
 * whitelist is unwrapped (the tag itself is dropped, but its still-unsanitized
 * children are kept and recursively sanitized in turn) except <script> and
 * <style>, whose contents are dropped entirely rather than unwrapped. The
 * only attribute kept anywhere is href on <a>, and only when it's an
 * http(s)/mailto link — never javascript:, data:, or anything else — and
 * such links are forced to target="_blank" rel="noopener noreferrer".
 */
function sanitize_rich_text(string $html): string
{
    $allowedTags = ['b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'br', 'p', 'a', 'span', 'div'];

    $dom = new DOMDocument();
    libxml_use_internal_errors(true);
    // The xml encoding declaration is a standard trick to make DOMDocument
    // treat the input as UTF-8 (its default HTML parsing assumes
    // ISO-8859-1, which mangles accented characters); NOIMPLIED/NODEFDTD
    // stop it from adding a surrounding <html><body> and a doctype.
    $dom->loadHTML(
        '<?xml encoding="utf-8" ?><div>' . $html . '</div>',
        LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD | LIBXML_NOERROR | LIBXML_NOWARNING
    );
    libxml_clear_errors();

    $container = $dom->getElementsByTagName('div')->item(0);
    if (!$container) {
        return '';
    }

    sanitize_dom_node($container, $allowedTags);

    $result = '';
    foreach ($container->childNodes as $child) {
        $result .= $dom->saveHTML($child);
    }
    return trim($result);
}

/**
 * Recursive worker for sanitize_rich_text(). Walks $node's children as a
 * manual linked list (firstChild/nextSibling) rather than a pre-snapshotted
 * array — when a disallowed tag is unwrapped, its own children get spliced
 * into $node in its place, and they must still be visited by this same walk
 * (a naive one-pass-over-a-snapshot approach would skip them, letting e.g. a
 * <script> nested inside a disallowed wrapper tag slip through unsanitized).
 */
function sanitize_dom_node(DOMNode $node, array $allowedTags): void
{
    $child = $node->firstChild;
    while ($child !== null) {
        $next = $child->nextSibling; // grab before any mutation invalidates it

        if ($child->nodeType === XML_TEXT_NODE) {
            $child = $next;
            continue;
        }
        if ($child->nodeType !== XML_ELEMENT_NODE) {
            // Comments, processing instructions, etc.
            $node->removeChild($child);
            $child = $next;
            continue;
        }

        $tag = strtolower($child->nodeName);

        if (!in_array($tag, $allowedTags, true)) {
            if (in_array($tag, ['script', 'style'], true)) {
                $node->removeChild($child);
                $child = $next;
                continue;
            }
            // Unwrap: splice this tag's children into its place, then resume
            // the walk from the first of them — they haven't been sanitized
            // yet themselves.
            $firstMoved = $child->firstChild;
            while ($child->firstChild) {
                $node->insertBefore($child->firstChild, $child);
            }
            $node->removeChild($child);
            $child = $firstMoved ?: $next;
            continue;
        }

        if ($child->hasAttributes()) {
            $attrNames = [];
            foreach ($child->attributes as $attr) {
                $attrNames[] = $attr->name;
            }
            foreach ($attrNames as $attrName) {
                if ($tag === 'a' && strtolower($attrName) === 'href') {
                    $href = trim($child->getAttribute('href'));
                    if (!preg_match('/^(https?:|mailto:)/i', $href)) {
                        $child->removeAttribute('href');
                    }
                    continue;
                }
                $child->removeAttribute($attrName);
            }
            if ($tag === 'a' && $child->getAttribute('href') !== '') {
                $child->setAttribute('target', '_blank');
                $child->setAttribute('rel', 'noopener noreferrer');
            }
        }

        sanitize_dom_node($child, $allowedTags);
        $child = $next;
    }
}

/**
 * Checks a submitted captcha answer against the one generate_captcha_challenge()
 * stashed in the session, then always clears it — right or wrong — so a
 * single challenge can never be replayed across multiple login attempts.
 * Also rejects anything older than 10 minutes, so a long-abandoned page
 * can't be used to skip solving a fresh one.
 */
function verify_captcha_answer($submitted): bool
{
    start_session();
    $expected = $_SESSION['captcha_answer'] ?? null;
    $generatedAt = $_SESSION['captcha_generated_at'] ?? 0;
    unset($_SESSION['captcha_answer'], $_SESSION['captcha_generated_at']);

    if ($expected === null || $submitted === null || $submitted === '') {
        return false;
    }
    if (time() - $generatedAt > 600) {
        return false;
    }
    return is_numeric($submitted) && (int) $submitted === (int) $expected;
}

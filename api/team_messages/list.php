<?php
// Lists a team's "Messages board" posts, in display order — shown above "My
// favorite office days" on everyone's "This week" tab. Any active member can
// view; only a manager can create/edit/delete/reorder (see the other
// endpoints in this folder).
require_once __DIR__ . '/../helpers.php';

$userId = require_auth();
$teamId = (int) ($_GET['team_id'] ?? 0);

if (!$teamId) {
    json_error('missing_team_id', 422);
}

require_member($userId, $teamId);

$stmt = db()->prepare(
    'SELECT tm.id, tm.content, tm.sort_order, tm.created_at, tm.updated_at,
            creator.full_name AS created_by_name,
            editor.full_name AS updated_by_name,
            tm.created_by, tm.updated_by
     FROM team_messages tm
     JOIN users creator ON creator.id = tm.created_by
     LEFT JOIN users editor ON editor.id = tm.updated_by
     WHERE tm.team_id = ?
     ORDER BY tm.sort_order ASC, tm.created_at ASC'
);
$stmt->execute([$teamId]);

json_response(['ok' => true, 'messages' => $stmt->fetchAll()]);

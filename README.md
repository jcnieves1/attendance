# OfficePal 🐸

A friendly office-attendance tracker. Employees check in the days they come to the
office; managers create teams, invite existing users to join, suggest which days
the team should attend, and see a yearly attendance dashboard. Built with plain
HTML/CSS/JavaScript on the frontend and a PHP + MySQL backend. Fully mobile
responsive, and everything — invitations included — happens inside the app
itself, with no email dependency anywhere.

## What's included

- Email + password accounts (real name required, so managers know who's who).
- Anyone can create a team and becomes its manager (owner); owners can promote
  teammates to **admin** (assistant manager) to help run the group.
- In-app invitations only: managers search existing OfficePal users by name or
  email and send them a team invite. The invitee sees it appear under the
  bell icon next time they open the app and accepts or declines right there —
  no email, no links, no tokens.
- Per-team **tracking mode**: an admin can set a team to track **week days
  only** (Mon–Fri) or the **full week** (Mon–Sun). Weekend columns are hidden
  everywhere in the UI for teams that don't need them, keeping the grid and
  dashboards compact.
- Manager/admin "suggested days" picker (e.g. "come in Monday & Wednesday"),
  shown to employees as the team's current recommendation.
- Employees pick their own personal favorite days too, independent of the
  manager's suggestion.
- A weekly check-in grid — tap a day to check in or out, instantly, no
  confirmation dialogs.
- Personal dashboard + a team/yearly dashboard with a GitHub-style attendance
  heatmap, visible to every member (not just managers).
- A dedicated Admin area (owner/admin only) for invitations, roles, tracking
  mode, suggested days, and the manager's yearly dashboard.
- English/Spanish language toggle and 5 selectable color themes (Sunrise,
  Forest, Midnight, Peach, Cloud), both saved per-user.
- Fully responsive layout: a slide-in sidebar drawer with a hamburger toggle
  on small screens, a stacked topbar, and grids/modals that reflow for phones.
- Both dashboards (personal and Admin area) can be filtered by year, or
  narrowed further to a single month, so a full year of data doesn't have to
  be scanned at once.
- Self-service **forgot password**, right from the login screen: a user sets
  an optional security question when they register (or later from **My
  account**), and can answer it to set a new password without anyone's help.
  Accounts without one — or a forgotten answer — fall back to asking a
  manager/admin of one of their teams, who can reset their password from the
  Admin area's member list (never the team owner's, and never their own).
- Everyone can change their own password any time from **My account**.
- Admins can download the attendance dashboard as an Excel (.xlsx) file,
  honoring whatever year/month filter is currently applied.
- Pal the frog 🐸 — a friendly mascot who carries a little notebook and
  pencil everywhere, cheerfully "taking notes" on who's checked in.

## Requirements

- PHP 8.0+ with the `pdo_mysql`, `zip`, and `dom` extensions (all enabled by
  default in most PHP installs). `zip` is only needed for the Admin area's
  Excel export, and `dom` only for sanitizing Messages board rich text — the
  rest of the app works fine without either.
- MySQL 8+ or MariaDB 10.4+.

No outgoing mail server, API key, or Composer dependency is needed — OfficePal
doesn't send email at all, and its Excel export is written with PHP's built-in
`ZipArchive` rather than a library.

## 1. Create the database

```bash
mysql -u root -p -e "CREATE DATABASE officepal CHARACTER SET utf8mb4;"
mysql -u root -p officepal < database/schema.sql
```

If you're upgrading an existing install that predates in-app invitations, run
the migration instead of (or after) the base schema:

```bash
mysql -u root -p officepal < database/migrate_v2_inapp_invites.sql
```

It adds the `teams.track_weekends` column, converts the `invitations` table to
reference existing users instead of raw email/token pairs (matching pending
invites to accounts by email and dropping any that can't be matched), and
removes the now-unused `email_log` table and `attendance.manager_notified`
column.

If you're upgrading further to add the forgot-password / security-question
feature, also run:

```bash
mysql -u root -p officepal < database/migrate_v3_password_reset.sql
```

It adds `users.security_question` and `users.security_answer_hash` (both
nullable — existing accounts simply have no security question until they set
one from My account).

If you're upgrading further to add team renaming/join requests, also run:

```bash
mysql -u root -p officepal < database/migrate_v4_join_requests.sql
```

It adds `teams.join_policy` (`invite_only` by default, or `open`), a unique
index on `teams.name` (skipped automatically if you already have duplicate
team names — rename the clashing teams and re-run the migration to add it),
and the new `join_requests` table.

If you're upgrading further to add the 🔔 notification bell for member
removal and join requests, also run:

```bash
mysql -u root -p officepal < database/migrate_v5_notifications.sql
```

It adds the new `notifications` table.

If you're upgrading further so requesters get notified when their join
request is approved or rejected, also run:

```bash
mysql -u root -p officepal < database/migrate_v6_join_response_notifications.sql
```

It widens `notifications.type` to add `join_request_approved` and
`join_request_rejected`, and adds a nullable `notifications.actor_email`
column (so a rejection notification can tell the person who to contact).

If you're upgrading further to add "Auto-accept join requests", also run:

```bash
mysql -u root -p officepal < database/migrate_v7_auto_accept.sql
```

It adds `teams.auto_accept_join_requests` (off by default) and widens
`notifications.type` further to add `auto_joined` and `join_auto_approved`.

If you're upgrading further to add a personal default team, also run:

```bash
mysql -u root -p officepal < database/migrate_v8_default_team.sql
```

It adds a nullable `users.default_team_id` (FK to `teams.id`, `ON DELETE SET
NULL`) — the team automatically selected the next time that user logs in.

If you're upgrading further to add the login page's CAPTCHA + brute-force
guard, also run:

```bash
mysql -u root -p officepal < database/migrate_v9_login_attempts.sql
```

It adds a `login_attempts` table (email, IP, success, timestamp) that
`api/auth/login.php` uses to block further tries once an email has 5+ failed
attempts in the last 15 minutes. The CAPTCHA answer itself is never stored in
the database — it lives only in the PHP session between fetching the
challenge and submitting the form. The same CAPTCHA (not the rate limit) also
guards the **Create account** form, as a lightweight check against scripted
bulk sign-ups.

If you're upgrading further to add the Admin area's "Messages board", also
run:

```bash
mysql -u root -p officepal < database/migrate_v10_team_messages.sql
```

It adds a `team_messages` table. Message content is always passed through
`sanitize_rich_text()` (a whitelist-based sanitizer built on PHP's
`DOMDocument` — see api/helpers.php) before being written here, stripping
anything beyond a small safe set of formatting tags.

## 2. Configure the app

Edit `api/config.php` (or set the equivalent environment variables — handy if
you deploy this somewhere later):

| Setting | Env var | Notes |
|---|---|---|
| DB host | `OFFICEPAL_DB_HOST` | default `127.0.0.1` |
| DB port | `OFFICEPAL_DB_PORT` | default `3306` |
| DB name | `OFFICEPAL_DB_NAME` | default `officepal` |
| DB user | `OFFICEPAL_DB_USER` | default `root` |
| DB password | `OFFICEPAL_DB_PASS` | default empty |
| Base URL | `OFFICEPAL_BASE_URL` | default `http://localhost:8000` |

That's it — no mail settings required.

## 3. Run it locally

```bash
cd "OfficePal"
php -S localhost:8000
```

Open `http://localhost:8000` in your browser (or on your phone, pointed at
your machine's local IP, to try the mobile layout).

## 4. Try the full flow

1. Register an account (your real name + email + password).
2. Click **Create a team** — you become its manager.
3. Register a second account (use a different browser profile or an incognito
   window) so you have someone to invite.
4. Back in the first account's **Admin area** → **Invite someone**, search for
   the second account by name or email and send the invite.
5. Log in as the second account, tap the 🔔 bell in the topbar, and **Accept**
   the invitation — the team now appears in their sidebar.
6. In **Admin area**, choose the team's **tracking mode** (week days only or
   the full week), and pick the **suggested office days**.
7. On the **This week** tab, tap a day to check in or out — no dialogs, no
   emails, just an instant toggle.
8. Check the **Dashboard** tab (everyone can see it) and the manager's
   **Admin area** dashboard for the heatmap and per-person totals — use the
   year and month dropdowns above each to narrow the view down.
9. From the Admin area, click **Download Excel** to export the currently
   filtered dashboard as an .xlsx file.
10. Click the ⚙ icon in the topbar to open **My account**: change your own
    password, or set/update your security question for forgot-password.
11. Log out, click **Forgot your password?** on the login screen, and answer
    your security question to set a new one — no email involved. If an
    account has no security question set, try the Admin area's member list
    instead: a manager/admin can reset that person's password directly.
12. Shrink your browser window (or open the app on a phone) to see the
    hamburger menu and the responsive layout kick in.
13. In **Admin area** → **Team settings**, rename the team (the field checks
    availability live as you type) and edit its description, then tag it
    **Anyone can join** under **Who can join**.
14. From a third account, click **Find a team** in the sidebar, search for
    that team, and click **Request to join** — it won't add you right away.
15. Back in the first account's **Admin area** → **Join requests**, click
    **Accept** — the requester is added as an **employee** (never as admin),
    or **Reject** to turn them down. As soon as the request is sent, every
    owner/admin of that team sees a 🔔 notification with a **Review** button
    that jumps straight to this panel. Either way, the requester gets their
    own 🔔 notification naming who responded — a cheerful welcome if
    approved, or an apologetic note with that admin's email to contact if
    rejected.
16. From the **Members** list, click **Remove** on someone — a confirm
    dialog warns that this permanently deletes their attendance history for
    that team and can't be undone. Once confirmed, they'll see a 🔔
    notification the next time they open the app, with an **Acknowledge**
    button to dismiss it.
17. Back in **Team settings** → **Who can join**, with the team still set to
    **Anyone can join**, flip **Auto-accept join requests** to **On**. Have a
    third account **Find a team** → **Request to join** it again: this time
    they're added immediately, with a cheerful 🔔 welcome notification of
    their own — no approval step. The team's owner/admins still get a 🔔
    notification about it, with a **Manage users** button that jumps to the
    Admin area's Members list so they stay aware of who joined.
18. Your color theme (the dots in the topbar) and language now follow your
    account, not just the browser — switch either one, log out, and log back
    in (or as a different account on the same browser) to see it stick per
    person.
19. On the **This week** tab, below **My favorite office days**, check
    **Make this my default team when I log in** — if you belong to more than
    one team, this is the one you'll land on automatically next time you log
    in. If an admin ever removes you from that team, your default
    automatically falls back to another team you still belong to (or clears
    if that was your only one).
20. On the login screen, notice the small "What is X + Y?" security check
    below the password field — it must be answered correctly on every login
    attempt, and a wrong password or a wrong answer both serve up a fresh
    question. Five failed attempts for the same email within 15 minutes
    temporarily blocks further tries, as a basic guard against scripted
    brute-force login attempts.
21. In **Admin area** → **Messages board**, click **+ Add message**, write
    something with the bold/italic/underline/list/link toolbar, and save —
    it appears above **My favorite office days** on everyone's **This week**
    tab, labeled with who posted it and when. Drag messages by the handle to
    reorder them; employees see the board read-only, while owners/admins can
    edit, delete, and reorder from either the Admin area or right there on
    **This week**. Edit a message as a different admin and note the label
    updates to show who last edited it and the new timestamp.
22. Before logging in, scroll through the landing page in front of the login
    card: a hero pitch, a feature grid, a "How OfficePal works" walkthrough,
    a stats band, and made-up teammate reviews — all just marketing content,
    no backend involved. Click any **Get started free** or **Log in** button
    on the page (nav bar, hero, mid-page, or bottom) and confirm it switches
    the card to the right tab and smooth-scrolls it into view.
23. Click through all 5 theme dots (topbar or landing nav): Sunrise, Forest,
    and Midnight are the original three, plus two new softer options —
    **Peach** (a pastel warm apricot/rose palette) and **Cloud** (a mostly
    white, low-contrast palette with a whisper of dusty blue). The choice is
    saved to your account like the other three.

## Project structure

```
OfficePal/
  index.html              Main app (login/register + the whole SPA)
  assets/
    css/styles.css         All styling, the 5 color themes, and mobile layout
    js/                     i18n.js, theme.js, api.js, app.js
    img/                    Pal the frog mascot (SVG, 3 poses)
  api/                     PHP backend (session-based auth, JSON responses)
    config.php, db.php, helpers.php, xlsx_helper.php
    auth/ teams/ invitations/ attendance/ favorites/ dashboard/ users/
  database/
    schema.sql                        Fresh-install MySQL schema
    migrate_v2_inapp_invites.sql       Upgrade path: email invites -> in-app
    migrate_v3_password_reset.sql     Upgrade path: adds security question
    migrate_v4_join_requests.sql      Upgrade path: team rename/join requests
    migrate_v5_notifications.sql      Upgrade path: adds notifications table
    migrate_v6_join_response_notifications.sql
                                       Upgrade path: notify on approve/reject
    migrate_v7_auto_accept.sql        Upgrade path: auto-accept join requests
    migrate_v8_default_team.sql       Upgrade path: personal default team
    migrate_v9_login_attempts.sql     Upgrade path: login CAPTCHA + rate limit
    migrate_v10_team_messages.sql     Upgrade path: Admin area messages board
```

## Notes on the design

- Roles are **owner** (creator, can't be removed/demoted), **admin**
  (assistant manager — can invite, remove members, set tracking mode and
  suggested days, see the dashboard, but can't change anyone's role), and
  **employee**.
- Invitations always target an existing user account (`invitations
  .invited_user_id`); there's no concept of inviting a bare email address.
  A manager searches for teammates via `api/users/search.php`, which excludes
  people who are already members or already have a pending invite.
- "Suggested days" is a standing weekly pattern per team (not tied to one
  specific week) — change it anytime from the Admin area and it applies to
  every week going forward, matching how most hybrid-office schedules work.
- Tracking mode (`teams.track_weekends`) is enforced both in the UI (weekend
  columns are never rendered for week-day-only teams) and on the server
  (`max_day_index_for_team()` rejects Saturday/Sunday suggested-day or
  favorite-day picks for those teams).
- Sessions use PHP's built-in cookie-based sessions; passwords are hashed with
  `password_hash()` (bcrypt), and so is a security-question answer if one is
  set (`users.security_answer_hash`) — the plain answer is never stored.
- Password resets: a manager/admin can reset any team member's password
  except the owner's — resetting the owner's password would effectively let
  an admin take over the owner's account, which defeats the point of the
  owner role being un-demotable. The owner can only be helped via their own
  security question, or by directly updating the database.
- The Excel export (`api/xlsx_helper.php`) hand-builds a minimal .xlsx (a zip
  of a few small XML parts) using PHP's `ZipArchive` — no PhpSpreadsheet or
  other Composer dependency.

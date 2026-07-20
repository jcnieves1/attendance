/* OfficePal — main single-page app logic. */

const APP = {
  user: null,
  teams: [],
  invitations: [],
  notifications: [],
  currentTeamId: null,
  currentTeamDetail: null,
  currentTab: "week",
  dashboardYear: new Date().getFullYear(),
  dashboardMonth: null,
  adminDashboardYear: new Date().getFullYear(),
  adminDashboardMonth: null,
};

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const MONTH_KEYS = [
  "month_jan", "month_feb", "month_mar", "month_apr", "month_may", "month_jun",
  "month_jul", "month_aug", "month_sep", "month_oct", "month_nov", "month_dec",
];

/* ----------------------------- date helpers ----------------------------- */

/**
 * Formats a Date as a Y-m-d string using the browser's LOCAL calendar date —
 * deliberately not toISOString(), which converts to UTC first and can land
 * on the wrong day for anyone west of Greenwich in the evening (e.g. 8pm in
 * US Pacific is already after midnight UTC). Attendance is a local-calendar
 * concept — "today" always means today on the user's own clock.
 */
function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function mondayOf(date) {
  const d = new Date(date);
  const dow = (d.getDay() + 6) % 7; // 0=Mon..6=Sun
  d.setDate(d.getDate() - dow);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function currentWeekDates() {
  const monday = mondayOf(new Date());
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Highest day index (0=Mon..6=Sun) a team tracks: 4 (Fri) or 6 (Sun). */
function maxDayIndex(teamDetail) {
  return teamDetail && teamDetail.team && teamDetail.team.track_weekends ? 6 : 4;
}

/** Date range (Y-m-d strings) for a dashboard filter: full year, or one month within it. */
function dashboardDateRange(year, month) {
  if (month) {
    const mm = String(month).padStart(2, "0");
    const from = `${year}-${mm}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;
    return { from, to };
  }
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

/**
 * How many days in [fromStr, toStr] someone could actually have checked in:
 * weekdays only unless the team tracks weekends, and never counting days
 * after today (the future hasn't happened yet). Used to turn a raw
 * check-in count into a meaningful percentage.
 */
function countApplicableDays(fromStr, toStr, trackWeekends) {
  const from = new Date(`${fromStr}T00:00:00`);
  let to = new Date(`${toStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (to > today) to = today;
  if (from > to) return 0;

  let count = 0;
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const dow = (d.getDay() + 6) % 7; // 0=Mon..6=Sun
    if (trackWeekends || dow <= 4) count++;
  }
  return count;
}

/**
 * Fills a year <select> and a month <select> (with an "all months" option)
 * for a dashboard filter, and wires both to call onChange(year, month) —
 * month is null when "all months" is selected.
 */
function buildYearMonthSelectors(yearSelectEl, monthSelectEl, year, month, onChange) {
  yearSelectEl.innerHTML = "";
  const thisYear = new Date().getFullYear();
  for (let y = thisYear; y >= thisYear - 3; y--) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    if (y === year) opt.selected = true;
    yearSelectEl.appendChild(opt);
  }

  monthSelectEl.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.value = "";
  allOpt.textContent = t("month_all");
  if (!month) allOpt.selected = true;
  monthSelectEl.appendChild(allOpt);
  for (let m = 1; m <= 12; m++) {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = t(MONTH_KEYS[m - 1]);
    if (m === month) opt.selected = true;
    monthSelectEl.appendChild(opt);
  }

  const emit = () => {
    const y = parseInt(yearSelectEl.value, 10);
    const m = monthSelectEl.value ? parseInt(monthSelectEl.value, 10) : null;
    onChange(y, m);
  };
  yearSelectEl.addEventListener("change", emit);
  monthSelectEl.addEventListener("change", emit);
}

/* ------------------------------- toasts --------------------------------- */

function showToast(message) {
  const container = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

/* -------------------------------- modals --------------------------------- */

function openModal(id) { document.getElementById(id).classList.remove("hidden"); }
function closeModal(id) { document.getElementById(id).classList.add("hidden"); }

/* -------------------------------- sidebar drawer (mobile) ------------------ */

function openSidebar() {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("sidebar-backdrop").classList.add("open");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebar-backdrop").classList.remove("open");
}

/* ------------------------------- bootstrap -------------------------------- */

document.addEventListener("DOMContentLoaded", boot);

async function boot() {
  initTheme();
  setLang(getLang());
  wireThemeDots();
  wireLangSelectors();
  wireAuthForms();
  wireForgotPassword();
  wireStaticButtons();

  try {
    const res = await apiGet("auth/me.php");
    if (res.user) {
      APP.user = res.user;
      enterApp();
    } else {
      showAuthScreen();
    }
  } catch (e) {
    showAuthScreen();
  }
}

function wireThemeDots() {
  document.querySelectorAll(".theme-dot").forEach((dot) => {
    dot.addEventListener("click", async () => {
      setTheme(dot.dataset.theme);
      // Persist to the account (not just localStorage) so the choice follows
      // this user specifically — the same pattern as the language selector —
      // instead of just sticking to whichever browser/device they're on.
      if (APP.user) {
        try {
          await apiPost("auth/update_profile.php", { theme: dot.dataset.theme });
          APP.user.theme = dot.dataset.theme;
        } catch (e) {
          // Non-fatal: the theme still applies locally for this session.
        }
      }
    });
  });
}

function wireLangSelectors() {
  ["auth-lang", "app-lang"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = getLang();
    el.addEventListener("change", async (e) => {
      setLang(e.target.value);
      if (APP.user) {
        try { await apiPost("auth/update_profile.php", { language: e.target.value }); } catch (e) {}
        renderMain();
      }
    });
  });
}

function showAuthScreen() {
  document.getElementById("auth-screen").classList.remove("hidden");
  document.getElementById("app-shell").classList.add("hidden");
}

function enterApp() {
  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("app-shell").classList.remove("hidden");
  document.getElementById("current-user-name").textContent = APP.user.full_name;
  document.getElementById("app-lang").value = APP.user.language || getLang();
  setLang(APP.user.language || getLang());
  if (APP.user.theme) setTheme(APP.user.theme);
  loadSidebarData();
}

/* -------------------------------- auth forms ------------------------------ */

function wireAuthForms() {
  document.getElementById("tab-login").addEventListener("click", () => switchAuthTab("login"));
  document.getElementById("tab-register").addEventListener("click", () => switchAuthTab("register"));

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("login-error");
    errorEl.textContent = "";
    try {
      await apiPost("auth/login.php", {
        email: document.getElementById("login-email").value,
        password: document.getElementById("login-password").value,
      });
      const me = await apiGet("auth/me.php");
      APP.user = me.user;
      enterApp();
    } catch (err) {
      errorEl.textContent = err.message || t("login_error");
    }
  });

  document.getElementById("register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("register-error");
    errorEl.textContent = "";
    try {
      await apiPost("auth/register.php", {
        full_name: document.getElementById("register-name").value,
        email: document.getElementById("register-email").value,
        password: document.getElementById("register-password").value,
        security_question: document.getElementById("register-security-question").value,
        security_answer: document.getElementById("register-security-answer").value,
        language: getLang(),
      });
      const me = await apiGet("auth/me.php");
      APP.user = me.user;
      enterApp();
    } catch (err) {
      errorEl.textContent = err.message || t("error_generic");
    }
  });
}

function switchAuthTab(which) {
  document.getElementById("tab-login").classList.toggle("active", which === "login");
  document.getElementById("tab-register").classList.toggle("active", which === "register");
  document.getElementById("login-form").classList.toggle("hidden", which !== "login");
  document.getElementById("register-form").classList.toggle("hidden", which !== "register");
}

/* --------------------------- forgot password (login screen) ------------------- */

function wireForgotPassword() {
  const stepEmail = document.getElementById("forgot-step-email");
  const stepAnswer = document.getElementById("forgot-step-answer");
  const stepNoQuestion = document.getElementById("forgot-step-no-question");

  function resetForgotModal() {
    document.getElementById("forgot-email").value = "";
    document.getElementById("forgot-answer").value = "";
    document.getElementById("forgot-new-password").value = "";
    document.getElementById("forgot-email-error").textContent = "";
    document.getElementById("forgot-answer-error").textContent = "";
    stepEmail.classList.remove("hidden");
    stepAnswer.classList.add("hidden");
    stepNoQuestion.classList.add("hidden");
  }

  document.getElementById("forgot-password-link").addEventListener("click", (e) => {
    e.preventDefault();
    resetForgotModal();
    openModal("modal-forgot-password");
  });
  document.getElementById("close-forgot-modal").addEventListener("click", () => closeModal("modal-forgot-password"));

  document.getElementById("forgot-continue-btn").addEventListener("click", async () => {
    const email = document.getElementById("forgot-email").value.trim();
    const errorEl = document.getElementById("forgot-email-error");
    errorEl.textContent = "";
    if (!email) return;
    try {
      const res = await apiGet("auth/forgot_password_lookup.php", { email });
      if (res.has_question) {
        document.getElementById("forgot-question-text").textContent = res.question;
        stepEmail.classList.add("hidden");
        stepAnswer.classList.remove("hidden");
      } else {
        stepEmail.classList.add("hidden");
        stepNoQuestion.classList.remove("hidden");
      }
    } catch (err) {
      errorEl.textContent = err.message || t("error_generic");
    }
  });

  document.getElementById("forgot-submit-btn").addEventListener("click", async () => {
    const email = document.getElementById("forgot-email").value.trim();
    const answer = document.getElementById("forgot-answer").value;
    const newPassword = document.getElementById("forgot-new-password").value;
    const errorEl = document.getElementById("forgot-answer-error");
    errorEl.textContent = "";
    if (newPassword.length < 8) {
      errorEl.textContent = t("weak_password_error");
      return;
    }
    try {
      await apiPost("auth/reset_password.php", { email, security_answer: answer, new_password: newPassword });
      showToast(t("password_reset_success"));
      closeModal("modal-forgot-password");
    } catch (err) {
      errorEl.textContent = err.message || t("error_generic");
    }
  });
}

/* ------------------------------ static buttons ----------------------------- */

function wireStaticButtons() {
  document.getElementById("logout-btn").addEventListener("click", async () => {
    await apiPost("auth/logout.php", {});
    APP.user = null;
    APP.teams = [];
    APP.invitations = [];
    APP.notifications = [];
    APP.currentTeamId = null;
    location.reload();
  });

  document.getElementById("new-team-btn").addEventListener("click", () => openModal("modal-create-team"));
  document.getElementById("cancel-create-team").addEventListener("click", () => closeModal("modal-create-team"));
  document.getElementById("confirm-create-team").addEventListener("click", async () => {
    const name = document.getElementById("new-team-name").value.trim();
    if (!name) return;
    try {
      const res = await apiPost("teams/create.php", {
        name,
        description: document.getElementById("new-team-desc").value.trim(),
      });
      document.getElementById("new-team-name").value = "";
      document.getElementById("new-team-desc").value = "";
      closeModal("modal-create-team");
      await loadSidebarData();
      selectTeam(res.team_id);
    } catch (err) {
      showToast(err.message || t("error_generic"));
    }
  });

  // "Find a team" — discover + request to join teams tagged 'open'.
  document.getElementById("find-team-btn").addEventListener("click", () => {
    document.getElementById("find-team-search").value = "";
    loadFindTeamResults("");
    openModal("modal-find-team");
  });
  document.getElementById("close-find-team-modal").addEventListener("click", () => closeModal("modal-find-team"));

  let findTeamDebounce = null;
  document.getElementById("find-team-search").addEventListener("input", (e) => {
    clearTimeout(findTeamDebounce);
    const q = e.target.value.trim();
    findTeamDebounce = setTimeout(() => loadFindTeamResults(q), 250);
  });

  async function loadFindTeamResults(q) {
    const box = document.getElementById("find-team-results");
    box.innerHTML = `<p data-t="loading" style="color:var(--text-muted); font-size:13px;">Loading...</p>`;
    try {
      const res = await apiGet("teams/browse.php", { q });
      renderFindTeamResults(res.teams);
    } catch (err) {
      box.innerHTML = `<p class="error-msg">${err.message || t("error_generic")}</p>`;
    }
  }

  function renderFindTeamResults(teams) {
    const box = document.getElementById("find-team-results");
    if (!teams.length) {
      box.innerHTML = `<p style="color:var(--text-muted); font-size:13px;">${t("no_open_teams_found")}</p>`;
      return;
    }
    box.innerHTML = teams.map((team) => `
      <div class="invite-list-item">
        <div>
          <div style="font-weight:600;">${escapeHtml(team.name)}</div>
          <div style="font-size:12px; color:var(--text-muted);">${escapeHtml(team.description || "")}</div>
        </div>
        <button class="btn ${team.has_pending_request ? "ghost" : ""} small" data-team-id="${team.id}" ${team.has_pending_request ? "disabled" : ""}>
          ${team.has_pending_request ? t("already_requested_label") : t("request_to_join_button")}
        </button>
      </div>
    `).join("");
    box.querySelectorAll("button[data-team-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const teamId = parseInt(btn.dataset.teamId, 10);
        btn.disabled = true;
        try {
          const res = await apiPost("teams/request_join.php", { team_id: teamId });
          if (res.auto_approved) {
            // Auto-accept teams add the person right away — refresh the
            // sidebar so the new team shows up without needing a reload.
            showToast(t("join_auto_approved_toast"));
            btn.textContent = t("already_joined_label");
            await loadSidebarData();
          } else {
            showToast(t("join_request_sent_toast"));
            btn.textContent = t("already_requested_label");
          }
          btn.classList.add("ghost");
        } catch (err) {
          btn.disabled = false;
          showToast(err.message || t("error_generic"));
        }
      });
    });
  }

  // Mobile sidebar drawer.
  document.getElementById("hamburger-btn").addEventListener("click", () => {
    const sidebar = document.getElementById("sidebar");
    if (sidebar.classList.contains("open")) closeSidebar();
    else openSidebar();
  });
  document.getElementById("sidebar-backdrop").addEventListener("click", closeSidebar);

  // Invitations bell + modal.
  document.getElementById("invitations-bell").addEventListener("click", () => {
    renderInvitationsModal();
    openModal("modal-invitations");
  });
  document.getElementById("close-invitations-modal").addEventListener("click", () => closeModal("modal-invitations"));

  // Acknowledge all notifications at once — destructive + irreversible, so
  // it's gated behind its own confirm dialog, same pattern as removing a
  // teammate.
  document.getElementById("acknowledge-all-notifications-btn").addEventListener("click", () => {
    if (!APP.notifications.length) return;
    openModal("modal-confirm-clear-notifications");
  });
  document.getElementById("cancel-clear-notifications-btn").addEventListener("click", () => {
    closeModal("modal-confirm-clear-notifications");
  });
  document.getElementById("confirm-clear-notifications-btn").addEventListener("click", async () => {
    closeModal("modal-confirm-clear-notifications");
    try {
      await apiPost("notifications/acknowledge_all.php", {});
      APP.notifications = [];
      renderInvitationsBadge();
      renderNotificationsModalList();
      showToast(t("notifications_cleared_toast"));
    } catch (err) {
      showToast(err.message || t("error_generic"));
    }
  });

  // My account (change password + security question).
  document.getElementById("account-btn").addEventListener("click", () => {
    document.getElementById("account-current-password").value = "";
    document.getElementById("account-new-password").value = "";
    document.getElementById("account-password-error").textContent = "";
    document.getElementById("account-password-success").classList.add("hidden");
    document.getElementById("account-security-question").value = (APP.user && APP.user.security_question) || "";
    document.getElementById("account-security-answer").value = "";
    document.getElementById("account-security-error").textContent = "";
    openModal("modal-account");
  });
  document.getElementById("close-account-modal").addEventListener("click", () => closeModal("modal-account"));

  document.getElementById("account-change-password-btn").addEventListener("click", async () => {
    const errorEl = document.getElementById("account-password-error");
    const successEl = document.getElementById("account-password-success");
    errorEl.textContent = "";
    successEl.classList.add("hidden");
    const current = document.getElementById("account-current-password").value;
    const next = document.getElementById("account-new-password").value;
    if (next.length < 8) {
      errorEl.textContent = t("weak_password_error");
      return;
    }
    try {
      await apiPost("auth/change_password.php", { current_password: current, new_password: next });
      successEl.classList.remove("hidden");
      document.getElementById("account-current-password").value = "";
      document.getElementById("account-new-password").value = "";
    } catch (err) {
      errorEl.textContent = err.message || t("error_generic");
    }
  });

  document.getElementById("account-save-security-btn").addEventListener("click", async () => {
    const errorEl = document.getElementById("account-security-error");
    errorEl.textContent = "";
    const q = document.getElementById("account-security-question").value.trim();
    const a = document.getElementById("account-security-answer").value.trim();
    if (!q || !a) {
      errorEl.textContent = t("security_question_both_required");
      return;
    }
    try {
      await apiPost("auth/update_profile.php", { security_question: q, security_answer: a });
      if (APP.user) APP.user.security_question = q;
      showToast(t("saved"));
      document.getElementById("account-security-answer").value = "";
    } catch (err) {
      errorEl.textContent = err.message || t("error_generic");
    }
  });

  // Person attendance calendar (admin dashboard, "Per person" breakdown).
  document.getElementById("close-person-calendar-modal").addEventListener("click", () => closeModal("modal-person-calendar"));

  // Attendance confirm dialog + bigger "it worked" result popup.
  document.getElementById("cancel-attendance-btn").addEventListener("click", () => {
    pendingAttendanceAction = null;
    closeModal("modal-confirm-attendance");
  });
  document.getElementById("confirm-attendance-btn").addEventListener("click", async () => {
    if (!pendingAttendanceAction) return;
    const { teamId, dateStr, isChecked, onDone } = pendingAttendanceAction;
    pendingAttendanceAction = null;
    closeModal("modal-confirm-attendance");
    const ok = await toggleAttendance(teamId, dateStr, isChecked);
    if (ok) {
      showAttendanceResultModal(dateStr, isChecked);
      if (onDone) onDone();
    }
  });
  document.getElementById("close-attendance-result-btn").addEventListener("click", () => closeModal("modal-attendance-result"));

  // Reset a teammate's password (admin area).
  document.getElementById("cancel-reset-password").addEventListener("click", () => closeModal("modal-reset-password"));
  document.getElementById("confirm-reset-password").addEventListener("click", async () => {
    if (!resetPasswordTarget) return;
    const pw = document.getElementById("reset-member-new-password").value;
    const errorEl = document.getElementById("reset-password-error");
    errorEl.textContent = "";
    if (pw.length < 8) {
      errorEl.textContent = t("weak_password_error");
      return;
    }
    try {
      await apiPost("teams/reset_member_password.php", {
        team_id: resetPasswordTarget.teamId,
        user_id: resetPasswordTarget.userId,
        new_password: pw,
      });
      showToast(t("password_reset_success"));
      closeModal("modal-reset-password");
    } catch (err) {
      errorEl.textContent = err.message || t("error_generic");
    }
  });

  // Remove a teammate (admin area) — destructive + irreversible, so this is
  // gated behind its own confirm dialog rather than firing right away.
  document.getElementById("cancel-remove-member-btn").addEventListener("click", () => {
    pendingRemoveMember = null;
    closeModal("modal-confirm-remove-member");
  });
  document.getElementById("confirm-remove-member-btn").addEventListener("click", async () => {
    if (!pendingRemoveMember) return;
    const { teamId, userId } = pendingRemoveMember;
    pendingRemoveMember = null;
    closeModal("modal-confirm-remove-member");
    try {
      await apiPost("teams/remove_member.php", { team_id: teamId, user_id: userId });
      showToast(t("member_removed_toast"));
      renderMain();
    } catch (err) {
      showToast(err.message || t("error_generic"));
    }
  });
}

/* -------------------------------- sidebar ---------------------------------- */

async function loadSidebarData() {
  try {
    const [teamsRes, invitesRes, notifsRes] = await Promise.all([
      apiGet("teams/list.php"),
      apiGet("invitations/list_mine.php"),
      apiGet("notifications/list.php"),
    ]);
    APP.teams = teamsRes.teams;
    APP.invitations = invitesRes.invitations;
    APP.notifications = notifsRes.notifications;
    renderSidebar();
    renderInvitationsBadge();

    if (!APP.currentTeamId && APP.teams.length) {
      // Prefer the user's chosen default team (if they still belong to it)
      // over just picking the first one alphabetically.
      const defaultTeamId = APP.user && APP.user.default_team_id;
      const defaultStillValid = defaultTeamId && APP.teams.some((team) => team.id === defaultTeamId);
      selectTeam(defaultStillValid ? defaultTeamId : APP.teams[0].id);
    } else if (!APP.teams.length) {
      renderMain();
    }
  } catch (e) {
    showToast(t("error_generic"));
  }
}

function renderSidebar() {
  const list = document.getElementById("team-list");
  list.innerHTML = "";
  if (!APP.teams.length) {
    const empty = document.createElement("div");
    empty.style.cssText = "padding:8px 12px; font-size:13px; color:var(--text-muted);";
    empty.textContent = t("no_teams_yet");
    list.appendChild(empty);
  }
  APP.teams.forEach((team) => {
    const a = document.createElement("a");
    a.href = "#";
    a.className = "team-link" + (team.id === APP.currentTeamId ? " active" : "");
    a.innerHTML = `<span>${escapeHtml(team.name)}</span>` +
      (team.role !== "employee" ? `<span class="role-badge">${t("role_" + team.role)}</span>` : "");
    a.addEventListener("click", (e) => {
      e.preventDefault();
      selectTeam(team.id);
      closeSidebar();
    });
    list.appendChild(a);
  });
}

/* ------------------------------ invitations (bell + modal) ------------------ */

function renderInvitationsBadge() {
  const badge = document.getElementById("invitations-badge");
  const count = APP.invitations.length + APP.notifications.length;
  badge.textContent = count;
  badge.classList.toggle("hidden", count === 0);
}

function renderInvitationsModal() {
  const list = document.getElementById("invitations-modal-list");
  if (!APP.invitations.length) {
    list.innerHTML = `<p style="color:var(--text-muted); font-size:14px;">${t("no_pending_invitations")}</p>`;
  } else {
    list.innerHTML = "";
    APP.invitations.forEach((inv) => {
      const row = document.createElement("div");
      row.className = "invite-list-item";
      row.innerHTML = `
        <div>
          <div style="font-weight:600;">${escapeHtml(inv.team_name)}</div>
          <div style="font-size:12px; color:var(--text-muted);">${t("invited_by_label")} ${escapeHtml(inv.invited_by_name)} &middot; ${t("role_" + inv.role)}</div>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn small" data-action="accept" data-id="${inv.id}">${t("accept")}</button>
          <button class="btn ghost small" data-action="decline" data-id="${inv.id}">${t("decline")}</button>
        </div>
      `;
      list.appendChild(row);
    });

    list.querySelectorAll("button[data-action]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const invitationId = parseInt(btn.dataset.id, 10);
        const action = btn.dataset.action;
        try {
          if (action === "accept") {
            await apiPost("invitations/accept.php", { invitation_id: invitationId });
            showToast(t("invite_accepted"));
          } else {
            await apiPost("invitations/decline.php", { invitation_id: invitationId });
            showToast(t("invite_declined"));
          }
          await loadSidebarData();
          renderInvitationsModal();
        } catch (err) {
          showToast(err.message || t("error_generic"));
        }
      });
    });
  }

  renderNotificationsModalList();
}

// Notification types that take you somewhere (vs. a plain Acknowledge),
// each paired with the Admin-area element worth scrolling into view once
// you land there.
const NOTIF_NAV_TARGETS = {
  join_request: "join-requests-list",
  auto_joined: "members-list",
};

/** Builds the display text for one 🔔 notification, based on its type. */
function buildNotificationMessage(n) {
  const team = escapeHtml(n.team_name);
  const actor = escapeHtml(n.actor_name || "");
  const email = escapeHtml(n.actor_email || "");
  switch (n.type) {
    case "join_request":
      return t("notif_join_request_message").replace("{name}", actor).replace("{team}", team);
    case "join_request_approved":
      return t("notif_join_approved_message").replace("{actor}", actor).replace("{team}", team);
    case "join_request_rejected": {
      const emailHtml = email ? `<a href="mailto:${email}">${email}</a>` : "";
      return t("notif_join_rejected_message").replace("{actor}", actor).replace("{team}", team).replace("{email}", emailHtml);
    }
    case "auto_joined":
      return t("notif_auto_joined_message").replace("{name}", actor).replace("{team}", team);
    case "join_auto_approved":
      return t("notif_join_auto_approved_message").replace("{team}", team);
    default: // removed_from_team
      return t("notif_removed_message").replace("{team}", team);
  }
}

/**
 * Renders the informational 🔔 notifications (distinct from invitations,
 * which have their own accept/decline flow above): a teammate being removed
 * from a team, someone waiting on a join-request decision (or told about a
 * direct auto-join), or a requester being told their own join request was
 * approved/rejected — automatically or by an admin. Anything in
 * NOTIF_NAV_TARGETS jumps into the Admin area; everything else is a plain
 * "Acknowledge" that just marks it read.
 */
function renderNotificationsModalList() {
  const box = document.getElementById("notifications-modal-list");
  // "Acknowledge all" only makes sense once there's something to acknowledge.
  document.getElementById("acknowledge-all-notifications-btn").disabled = !APP.notifications.length;
  if (!APP.notifications.length) {
    box.innerHTML = `<p style="color:var(--text-muted); font-size:14px;">${t("no_notifications")}</p>`;
    return;
  }
  box.innerHTML = APP.notifications.map((n) => {
    const message = buildNotificationMessage(n);
    const isNavigable = Object.prototype.hasOwnProperty.call(NOTIF_NAV_TARGETS, n.type);
    const actionLabel = n.type === "auto_joined" ? t("manage_users_button") : (isNavigable ? t("review_button") : t("acknowledge_button"));
    const actionAttr = isNavigable
      ? `data-action="review" data-team-id="${n.team_id || ""}" data-focus="${NOTIF_NAV_TARGETS[n.type]}"`
      : `data-action="acknowledge"`;
    const timestamp = n.created_at ? formatDateTimeHuman(n.created_at) : "";
    return `
      <div class="invite-list-item">
        <div>
          <div>${message}</div>
          ${timestamp ? `<div style="font-size:12px; color:var(--text-muted); margin-top:2px;">${timestamp}</div>` : ""}
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn ${isNavigable ? "" : "ghost"} small" data-id="${n.id}" ${actionAttr}>${actionLabel}</button>
        </div>
      </div>
    `;
  }).join("");

  box.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const notificationId = parseInt(btn.dataset.id, 10);
      const action = btn.dataset.action;
      try {
        await apiPost("notifications/acknowledge.php", { notification_id: notificationId });
        APP.notifications = APP.notifications.filter((n) => n.id !== notificationId);
        renderInvitationsBadge();
        if (action === "review" && btn.dataset.teamId) {
          closeModal("modal-invitations");
          await goToTeamAdminArea(parseInt(btn.dataset.teamId, 10), btn.dataset.focus);
        } else {
          renderNotificationsModalList();
        }
      } catch (err) {
        showToast(err.message || t("error_generic"));
      }
    });
  });
}

/**
 * Jumps straight to a team's Admin area — used by the notification bell's
 * navigable actions (a pending join request to review, or an FYI about
 * someone who auto-joined). focusElementId, if given, is scrolled into view
 * once the Admin area has rendered, so the person lands right on the
 * relevant panel (Join requests or Members) instead of the top of the page.
 */
async function goToTeamAdminArea(teamId, focusElementId) {
  APP.currentTeamId = teamId;
  APP.currentTab = "admin";
  renderSidebar();
  await renderMain();
  if (focusElementId) {
    const el = document.getElementById(focusElementId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

async function selectTeam(teamId) {
  APP.currentTeamId = teamId;
  APP.currentTab = "week";
  renderSidebar();
  await renderMain();
}

/* --------------------------------- main view -------------------------------- */

async function renderMain() {
  const main = document.getElementById("main-content");

  if (!APP.currentTeamId) {
    main.innerHTML = `
      <div class="empty-state">
        <img src="assets/img/mascot-empty.svg" alt="Pal holding a sign" />
        <h2 data-t="no_teams_yet">No teams yet</h2>
        <p data-t="mascot_no_teams"></p>
      </div>`;
    applyTranslations();
    return;
  }

  main.innerHTML = `<p data-t="loading">Loading...</p>`;

  let detail;
  try {
    detail = await apiGet("teams/detail.php", { team_id: APP.currentTeamId });
  } catch (e) {
    main.innerHTML = `<p class="error-msg">${e.message || t("error_generic")}</p>`;
    return;
  }
  APP.currentTeamDetail = detail;

  const isManager = detail.my_role === "owner" || detail.my_role === "admin";

  main.innerHTML = `
    <div class="card-header">
      <div>
        <h1 style="margin-bottom:2px;">${escapeHtml(detail.team.name)}</h1>
        <div style="color:var(--text-muted); font-size:14px;">${escapeHtml(detail.team.description || "")}</div>
      </div>
      <span class="role-badge ${detail.my_role === "employee" ? "employee" : ""}">${t("role_" + detail.my_role)}</span>
    </div>
    <div class="tabs-row" id="team-tabs">
      <button data-tab="week" data-t="this_week">This week</button>
      <button data-tab="dashboard" data-t="dashboard_title">Dashboard</button>
      ${isManager ? `<button data-tab="admin" data-t="manager_area">Admin area</button>` : ""}
    </div>
    <div id="tab-content"></div>
  `;

  document.querySelectorAll("#team-tabs button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === APP.currentTab);
    btn.addEventListener("click", () => {
      APP.currentTab = btn.dataset.tab;
      renderMain();
    });
  });
  applyTranslations();

  if (APP.currentTab === "week") await renderWeekTab();
  else if (APP.currentTab === "dashboard") await renderDashboardTab();
  else if (APP.currentTab === "admin") await renderAdminTab();
}

/* --------------------------------- week tab ---------------------------------- */

async function renderWeekTab() {
  const container = document.getElementById("tab-content");
  const teamId = APP.currentTeamId;
  const maxDay = maxDayIndex(APP.currentTeamDetail);
  const weekDates = currentWeekDates().slice(0, maxDay + 1);
  const from = ymd(weekDates[0]);
  const to = ymd(weekDates[weekDates.length - 1]);

  const [mine, favorites] = await Promise.all([
    apiGet("attendance/mine.php", { team_id: teamId, from, to }),
    apiGet("favorites/get.php", { team_id: teamId }),
  ]);

  const checkedDates = new Set(mine.attendance.map((a) => a.attendance_date));
  const favoriteDows = new Set(favorites.days);
  const suggestedDows = new Set(APP.currentTeamDetail.suggested_days);
  const mascotMsg = pickMascotMessage();

  container.innerHTML = `
    <div class="mascot-banner">
      <img src="assets/img/mascot-wave.svg" alt="Pal" />
      <div class="speech-bubble">${mascotMsg}</div>
    </div>
    <div class="card">
      <h2 data-t="this_week">This week</h2>
      <div style="font-size:13px; color:var(--text-muted);" data-t="weekly_pattern_note"></div>
      <div class="week-grid" id="week-grid"></div>
    </div>
    <div class="card">
      <h3 data-t="favorite_days_title">My favorite office days</h3>
      <p style="font-size:13px; color:var(--text-muted);" data-t="favorite_days_hint"></p>
      <div class="checkbox-days" id="favorite-days-box"></div>
      <button class="btn small" id="save-favorites-btn" style="margin-top:12px;" data-t="save_favorites">Save my favorites</button>
    </div>
    <div class="card">
      <h3 data-t="default_team_title">Default team</h3>
      <p style="font-size:13px; color:var(--text-muted);" data-t="default_team_hint"></p>
      <label style="display:flex; align-items:center; gap:8px; font-weight:normal;">
        <input type="checkbox" id="default-team-checkbox" />
        <span data-t="default_team_checkbox_label">Make this my default team when I log in</span>
      </label>
    </div>
  `;
  applyTranslations();

  const grid = document.getElementById("week-grid");
  const todayStr = ymd(new Date());
  weekDates.forEach((date, i) => {
    const dstr = ymd(date);
    const isChecked = checkedDates.has(dstr);
    const isSuggested = suggestedDows.has(i);
    const isFavorite = favoriteDows.has(i);
    // Future days are read-only — you can't log attendance for a day that
    // hasn't happened yet. Compared against the browser's own clock, never
    // the server's, so this always matches what the user sees on their
    // computer right now.
    const isFuture = dstr > todayStr;

    const cell = document.createElement("div");
    cell.className = "day-cell" + (isChecked ? " checked-in" : "") + (isSuggested ? " suggested" : "") + (isFavorite ? " favorite" : "") + (isFuture ? " disabled" : "");
    cell.innerHTML = `
      ${isFavorite ? '<span class="fav-star">★</span>' : ""}
      <div class="dow">${t(DAY_KEYS[i])}</div>
      <div class="dnum">${date.getDate()}</div>
      ${isSuggested ? `<span class="tag">${t("suggested_tag")}</span>` : ""}
    `;
    if (isFuture) {
      cell.title = t("future_day_hint");
    } else {
      cell.title = isChecked ? t("tap_to_undo") : t("tap_to_checkin");
      cell.addEventListener("click", () => onDayCellClick(teamId, dstr, isChecked));
    }
    grid.appendChild(cell);
  });

  const favBox = document.getElementById("favorite-days-box");
  DAY_KEYS.slice(0, maxDay + 1).forEach((key, i) => {
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" value="${i}" ${favoriteDows.has(i) ? "checked" : ""}/> ${t(key)}`;
    favBox.appendChild(label);
  });
  document.getElementById("save-favorites-btn").addEventListener("click", async () => {
    const days = Array.from(favBox.querySelectorAll("input:checked")).map((el) => parseInt(el.value, 10));
    try {
      await apiPost("favorites/set.php", { team_id: teamId, days });
      showToast(t("saved"));
      renderWeekTab();
    } catch (err) {
      showToast(err.message || t("error_generic"));
    }
  });

  // --- default team (auto-selected on login) ---
  const defaultTeamCheckbox = document.getElementById("default-team-checkbox");
  defaultTeamCheckbox.checked = !!(APP.user && APP.user.default_team_id === teamId);
  defaultTeamCheckbox.addEventListener("change", async (e) => {
    const wantsDefault = e.target.checked;
    try {
      await apiPost("auth/set_default_team.php", { team_id: wantsDefault ? teamId : null });
      if (APP.user) APP.user.default_team_id = wantsDefault ? teamId : null;
      showToast(t(wantsDefault ? "default_team_set_toast" : "default_team_cleared_toast"));
    } catch (err) {
      e.target.checked = !wantsDefault; // revert the checkbox on failure
      showToast(err.message || t("error_generic"));
    }
  });
}

function pickMascotMessage() {
  const keys = ["mascot_welcome_2", "mascot_encourage_1", "mascot_encourage_2"];
  return t(keys[Math.floor(Math.random() * keys.length)]);
}

/** Formats a Y-m-d string as a long, locale-aware date for user-facing dialogs. */
function formatDateHuman(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const locale = getLang() === "es" ? "es-ES" : "en-US";
  return d.toLocaleDateString(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

/**
 * Formats a MySQL DATETIME string ("Y-m-d H:i:s") as a compact, locale-aware
 * date + time — used for the 🔔 notification timestamps, so people can tell
 * when each one was generated. Swaps the space for "T" so every browser
 * parses it as local time instead of guessing (or rejecting) the format.
 */
function formatDateTimeHuman(dateTimeStr) {
  const d = new Date(dateTimeStr.replace(" ", "T"));
  const locale = getLang() === "es" ? "es-ES" : "en-US";
  return d.toLocaleString(locale, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * Sends the actual check-in/uncheck request. Resolves true on success (safe
 * to re-render) or false if it failed (already reported via toast). Success
 * feedback itself is handled by the caller via the bigger result popup, not
 * here, so this stays a plain "do the thing" helper.
 */
async function toggleAttendance(teamId, dateStr, isChecked) {
  try {
    if (isChecked) {
      await apiPost("attendance/uncheck.php", { team_id: teamId, date: dateStr });
    } else {
      await apiPost("attendance/checkin.php", { team_id: teamId, date: dateStr });
    }
    return true;
  } catch (err) {
    showToast(err.message || t("error_generic"));
    return false;
  }
}

/* Pending attendance toggle awaiting confirmation via #modal-confirm-attendance. */
let pendingAttendanceAction = null;

/**
 * Asks "are you sure?" before adding or removing attendance for a date —
 * used by both the "This week" grid and the "My attendance" month calendar,
 * so every attendance change in the app goes through the same confirm step.
 * onDone runs after a successful toggle, so each caller can re-render
 * whichever view it owns.
 */
function confirmAttendanceToggle(teamId, dateStr, isChecked, onDone) {
  pendingAttendanceAction = { teamId, dateStr, isChecked, onDone };
  document.getElementById("confirm-attendance-title").textContent = t(isChecked ? "confirm_remove_title" : "confirm_checkin_title");
  document.getElementById("confirm-attendance-message").textContent = t(isChecked ? "confirm_remove_message" : "confirm_checkin_message");
  document.getElementById("confirm-attendance-date").textContent = formatDateHuman(dateStr);
  openModal("modal-confirm-attendance");
}

/**
 * Bigger, harder-to-miss confirmation shown after a toggle actually
 * succeeds — a modal instead of a corner toast, so it's obvious the action
 * went through. wasChecked reflects state *before* the toggle: true means
 * attendance was just removed, false means it was just added.
 */
function showAttendanceResultModal(dateStr, wasChecked) {
  document.getElementById("attendance-result-title").textContent = t(wasChecked ? "attendance_removed_title" : "attendance_added_title");
  document.getElementById("attendance-result-message").textContent = t(wasChecked ? "attendance_removed_message" : "attendance_added_message");
  document.getElementById("attendance-result-date").textContent = formatDateHuman(dateStr);
  document.getElementById("attendance-result-mascot").src = wasChecked ? "assets/img/mascot-wave.svg" : "assets/img/mascot-celebrate.svg";
  openModal("modal-attendance-result");
}

function onDayCellClick(teamId, dateStr, isChecked) {
  confirmAttendanceToggle(teamId, dateStr, isChecked, () => renderWeekTab());
}

/* ------------------------------- dashboard tab -------------------------------- */

async function renderDashboardTab() {
  const container = document.getElementById("tab-content");
  const teamId = APP.currentTeamId;
  const year = APP.dashboardYear;
  const month = APP.dashboardMonth;

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2 data-t="my_attendance_title">My attendance</h2>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <select id="dash-year" class="icon-select"></select>
          <select id="dash-month" class="icon-select"></select>
        </div>
      </div>
      <div id="my-dash-body"></div>
    </div>
    <div class="card">
      <h2 data-t="team_members_attendance">Teammates' attendance</h2>
      <div id="team-dash-body"></div>
    </div>
  `;
  applyTranslations();

  buildYearMonthSelectors(
    document.getElementById("dash-year"),
    document.getElementById("dash-month"),
    year,
    month,
    (y, m) => {
      APP.dashboardYear = y;
      APP.dashboardMonth = m;
      renderDashboardTab();
    }
  );

  const { from, to } = dashboardDateRange(year, month);

  const [mine, teamAttendance] = await Promise.all([
    apiGet("dashboard/employee.php", { team_id: teamId, year, month: month || "" }),
    apiGet("attendance/team.php", { team_id: teamId, from, to }),
  ]);

  renderMyDashboard(mine.attendance, year, month);
  renderTeamDashboard(teamAttendance.attendance, year, month);
}

function renderMyDashboard(rows, year, month) {
  const body = document.getElementById("my-dash-body");
  const total = rows.length;

  if (month) {
    // Narrowed to one month: a full calendar reads much better than a
    // bar-per-month chart with only one bar in it — each attended day gets
    // a little mascot badge so it's easy to spot at a glance.
    const checkedDates = new Set(rows.map((r) => r.attendance_date));
    const trackWeekends = !!(APP.currentTeamDetail && APP.currentTeamDetail.team && APP.currentTeamDetail.team.track_weekends);
    body.innerHTML = `
      <div style="font-size:32px; font-weight:700;">${total} <span style="font-size:14px; color:var(--text-muted); font-weight:500;">${t("total_days_month")}</span></div>
      <div class="cal-wrap">${buildMonthCalendarHtml(checkedDates, year, month, trackWeekends, true)}</div>
    `;
    wireMyCalendarEditing(body, checkedDates);
    return;
  }

  const byMonth = new Array(12).fill(0);
  rows.forEach((r) => byMonth[parseInt(r.attendance_date.slice(5, 7), 10) - 1]++);
  const maxMonth = Math.max(1, ...byMonth);

  body.innerHTML = `
    <div style="font-size:32px; font-weight:700;">${total} <span style="font-size:14px; color:var(--text-muted); font-weight:500;">${t("total_days_year")}</span></div>
    <div style="margin-top:16px;">
      ${byMonth.map((v, i) => `
        <div class="bar-row">
          <div class="bar-label">${t(MONTH_KEYS[i])}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${(v / maxMonth) * 100}%;"></div></div>
          <div style="width:22px; text-align:right; font-size:12px; color:var(--text-muted);">${v}</div>
        </div>
      `).join("")}
    </div>
  `;
}

/**
 * Wires click-to-toggle on the personal "My attendance" month calendar:
 * only cells marked .cal-editable by buildMonthCalendarHtml (today or a past
 * day the team actually tracks) respond to clicks, so future days can never
 * be edited. Re-renders the whole Dashboard tab on success, which keeps the
 * month total, the year view, and the "Teammates' attendance" heatmap all in
 * sync with the change.
 */
function wireMyCalendarEditing(container, checkedDates) {
  const teamId = APP.currentTeamId;
  container.querySelectorAll(".cal-day-cell.cal-editable[data-date]").forEach((cell) => {
    cell.addEventListener("click", () => {
      const dateStr = cell.dataset.date;
      confirmAttendanceToggle(teamId, dateStr, checkedDates.has(dateStr), () => renderDashboardTab());
    });
  });
}

/**
 * Builds a full month calendar (Mon-Sun header + day cells). Days the user
 * checked in get a little mascot badge instead of a plain checkmark, so
 * attendance in the selected month reads at a glance. For teams that don't
 * track weekends, Saturday/Sunday cells are shown (for date context) but
 * muted, since they're not part of that team's tracked schedule.
 *
 * When editable is true (the personal "My attendance" view only — never the
 * read-only teammate calendar modal), today and past trackable days get a
 * .cal-editable class + data-date so a click handler can toggle attendance;
 * future days are marked .cal-future (dimmed, not clickable) instead.
 */
function buildMonthCalendarHtml(checkedDatesSet, year, month, trackWeekends, editable = false) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7; // 0=Mon..6=Sun
  const todayStr = ymd(new Date());

  let cellsHtml = "";
  for (let i = 0; i < firstDow; i++) {
    cellsHtml += `<div class="cal-day-cell empty"></div>`;
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const dateStr = `${year}-${mm}-${dd}`;
    const dow = (firstDow + day - 1) % 7;
    const isWeekend = dow >= 5;
    const isChecked = checkedDatesSet.has(dateStr);
    const isToday = dateStr === todayStr;
    const isFuture = dateStr > todayStr;
    const isTrackable = trackWeekends || !isWeekend;
    const isEditable = editable && !isFuture && isTrackable;

    const classes = ["cal-day-cell"];
    if (isChecked) classes.push("checked");
    if (isToday) classes.push("today");
    if (isWeekend && !trackWeekends) classes.push("weekend-muted");
    if (isEditable) classes.push("cal-editable");
    if (editable && isFuture) classes.push("cal-future");

    const dateAttr = isEditable ? ` data-date="${dateStr}"` : "";
    const tooltip = isEditable ? `${dateStr} — ${t(isChecked ? "tap_to_undo" : "tap_to_checkin")}` : dateStr;

    cellsHtml += `
      <div class="${classes.join(" ")}"${dateAttr} title="${escapeHtml(tooltip)}">
        <div class="cal-day-num">${day}</div>
        ${isChecked ? `<img class="cal-day-mascot" src="assets/img/mascot-wave.svg" alt="${t("checked_in")}" />` : ""}
      </div>
    `;
  }

  const headerHtml = DAY_KEYS.map((key) => `<div class="cal-header-cell">${t(key)}</div>`).join("");

  return `
    <div class="cal-header-row">${headerHtml}</div>
    <div class="cal-grid">${cellsHtml}</div>
  `;
}

function renderTeamDashboard(rows, year, month) {
  const body = document.getElementById("team-dash-body");
  const byMember = {};
  rows.forEach((r) => {
    byMember[r.user_id] = byMember[r.user_id] || { id: r.user_id, name: r.full_name, count: 0 };
    byMember[r.user_id].count++;
  });
  const members = Object.values(byMember).sort((a, b) => b.count - a.count);

  const trackWeekends = !!(APP.currentTeamDetail && APP.currentTeamDetail.team && APP.currentTeamDetail.team.track_weekends);
  const heatmapHtml = month
    ? `<div class="heatcal-wrap">${buildHeatmapCalendarHtml(rows, year, month, trackWeekends)}</div>`
    : buildYearHeatmapCalendarsHtml(rows, year, trackWeekends);

  body.innerHTML = `
    ${heatmapHtml}
    <div class="heatmap-legend">
      <span>${t("days_attended")}:</span>
      <span class="heat-cell" data-level="0"></span>
      <span class="heat-cell" data-level="1"></span>
      <span class="heat-cell" data-level="2"></span>
      <span class="heat-cell" data-level="3"></span>
      <span class="heat-cell" data-level="4"></span>
    </div>
    <div style="margin-top:20px;">
      ${members.length ? members.map((m) => `
        <div class="member-row" data-user-id="${m.id}" data-user-name="${escapeHtml(m.name)}" title="${t("view_calendar_hint")}">
          <div class="member-name">${escapeHtml(m.name)}</div>
          <div class="member-meta">${m.count} ${t("days_attended")}</div>
        </div>
      `).join("") : `<p style="color:var(--text-muted);">—</p>`}
    </div>
  `;

  body.querySelectorAll(".member-row[data-user-id]").forEach((row) => {
    row.addEventListener("click", () => {
      openPersonCalendarModal(parseInt(row.dataset.userId, 10), row.dataset.userName, year, month, rows);
    });
  });
}

/**
 * Builds one month as a calendar grid where each day cell is colored by
 * attendance heat level (same 0-4 scale the old linear heatmap used), and
 * carries a tooltip with the date plus who actually checked in that day.
 * Used both for a single selected month and, one-per-month, for a whole
 * year's worth of mini calendars.
 */
function buildHeatmapCalendarHtml(rows, year, month, trackWeekends) {
  const namesByDate = {};
  rows.forEach((r) => {
    if (!namesByDate[r.attendance_date]) namesByDate[r.attendance_date] = [];
    namesByDate[r.attendance_date].push(r.full_name);
  });

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7; // 0=Mon..6=Sun
  const todayStr = ymd(new Date());

  let cellsHtml = "";
  for (let i = 0; i < firstDow; i++) {
    cellsHtml += `<div class="cal-day-cell empty"></div>`;
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const dateStr = `${year}-${mm}-${dd}`;
    const dow = (firstDow + day - 1) % 7;
    const isWeekend = dow >= 5;
    const isToday = dateStr === todayStr;
    const names = namesByDate[dateStr] || [];
    const c = names.length;
    const level = c === 0 ? 0 : c === 1 ? 1 : c === 2 ? 2 : c <= 4 ? 3 : 4;
    const tooltip = c ? `${dateStr} — ${names.join(", ")}` : dateStr;

    const classes = ["cal-day-cell", "heatcal-cell"];
    if (isToday) classes.push("today");
    if (isWeekend && !trackWeekends) classes.push("weekend-muted");

    cellsHtml += `
      <div class="${classes.join(" ")}" data-level="${level}" title="${escapeHtml(tooltip)}">
        <div class="cal-day-num">${day}</div>
      </div>
    `;
  }

  const headerHtml = DAY_KEYS.map((key) => `<div class="cal-header-cell">${t(key)}</div>`).join("");

  return `
    <div class="cal-header-row">${headerHtml}</div>
    <div class="cal-grid">${cellsHtml}</div>
  `;
}

/** All 12 months of a year, each rendered as its own small heat-colored calendar. */
function buildYearHeatmapCalendarsHtml(rows, year, trackWeekends) {
  let html = `<div class="heatcal-year-grid">`;
  for (let m = 1; m <= 12; m++) {
    html += `
      <div class="heatcal-month-card">
        <div class="heatcal-month-label">${t(MONTH_KEYS[m - 1])}</div>
        ${buildHeatmapCalendarHtml(rows, year, m, trackWeekends)}
      </div>
    `;
  }
  html += `</div>`;
  return html;
}

/* --------------------------------- admin tab ----------------------------------- */

let selectedInviteUser = null;
let userSearchDebounce = null;
let resetPasswordTarget = null;
let pendingRemoveMember = null;

async function renderAdminTab() {
  const container = document.getElementById("tab-content");
  const teamId = APP.currentTeamId;
  const detail = APP.currentTeamDetail;
  const isOwner = detail.my_role === "owner";
  const isManager = detail.my_role === "owner" || detail.my_role === "admin";
  const maxDay = maxDayIndex(detail);
  const suggestedDows = new Set(detail.suggested_days);
  selectedInviteUser = null;

  container.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <h2 data-t="invite_someone">Invite someone</h2>
        <p style="font-size:13px; color:var(--text-muted);" data-t="invite_search_hint"></p>
        <div class="user-search-wrap">
          <input type="text" id="invite-user-search" data-t-placeholder="invite_search_placeholder" autocomplete="off" />
          <div id="invite-user-results" class="user-search-results hidden"></div>
        </div>
        <div id="selected-user-box"></div>
        <label data-t="invite_role_label">Role</label>
        <select id="invite-role">
          <option value="employee">${t("role_employee")}</option>
          <option value="admin">${t("role_admin")}</option>
        </select>
        <button class="btn" id="send-invite-btn" style="margin-top:14px;" data-t="invite_button" disabled>Send invitation</button>
        <div class="error-msg" id="invite-error"></div>

        <h3 style="margin-top:24px;" data-t="pending_invitations_sent">Pending invitations sent</h3>
        <div id="team-pending-invites"></div>
      </div>

      <div class="card">
        <h2 data-t="tracking_mode_title">Days tracked</h2>
        <p style="font-size:13px; color:var(--text-muted);" data-t="tracking_mode_hint"></p>
        <div class="mode-toggle" id="tracking-mode-toggle">
          <button data-mode="weekdays">${t("tracking_mode_weekdays")}<span class="mode-desc">${t("tracking_mode_weekdays_desc")}</span></button>
          <button data-mode="all_week">${t("tracking_mode_all_week")}<span class="mode-desc">${t("tracking_mode_all_week_desc")}</span></button>
        </div>

        <h2 style="margin-top:24px;" data-t="suggested_days_title">Suggested office days</h2>
        <p style="font-size:13px; color:var(--text-muted);" data-t="suggested_days_hint"></p>
        <div class="checkbox-days" id="suggested-days-box"></div>
        <button class="btn small" id="save-suggested-btn" style="margin-top:12px;" data-t="save_suggested_days">Save suggested days</button>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h2 data-t="team_settings_title">Team settings</h2>
        <p style="font-size:13px; color:var(--text-muted);" data-t="team_settings_hint"></p>
        <label data-t="team_name_label">Team name</label>
        <input type="text" id="team-settings-name" value="${escapeHtml(detail.team.name)}" autocomplete="off" />
        <div id="team-name-check-msg" style="font-size:12px; margin-top:4px; min-height:16px;"></div>
        <label data-t="team_desc_label">Description (optional)</label>
        <input type="text" id="team-settings-desc" value="${escapeHtml(detail.team.description || "")}" autocomplete="off" />
        <button class="btn small" id="save-team-settings-btn" style="margin-top:12px;" data-t="save_team_settings" disabled>Save changes</button>
        <div class="error-msg" id="team-settings-error"></div>

        <h2 style="margin-top:24px;" data-t="join_policy_title">Who can join</h2>
        <p style="font-size:13px; color:var(--text-muted);" data-t="join_policy_hint"></p>
        <div class="mode-toggle" id="join-policy-toggle">
          <button data-policy="invite_only">${t("join_policy_invite_only")}<span class="mode-desc">${t("join_policy_invite_only_desc")}</span></button>
          <button data-policy="open">${t("join_policy_open")}<span class="mode-desc">${t("join_policy_open_desc")}</span></button>
        </div>

        ${detail.team.join_policy === "open" ? `
          <h2 style="margin-top:24px;" data-t="auto_accept_title">Auto-accept join requests</h2>
          <p style="font-size:13px; color:var(--text-muted);" data-t="auto_accept_hint"></p>
          <div class="mode-toggle" id="auto-accept-toggle">
            <button data-auto="0">${t("auto_accept_off")}<span class="mode-desc">${t("auto_accept_off_desc")}</span></button>
            <button data-auto="1">${t("auto_accept_on")}<span class="mode-desc">${t("auto_accept_on_desc")}</span></button>
          </div>
        ` : ""}
      </div>

      <div class="card">
        <h2 data-t="join_requests_title">Join requests</h2>
        <p style="font-size:13px; color:var(--text-muted);" data-t="join_requests_hint"></p>
        <div id="join-requests-list"></div>
      </div>
    </div>

    <div class="card">
      <h2 data-t="my_teams">Members</h2>
      <div id="members-list"></div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2 data-t="dashboard_title">Attendance dashboard</h2>
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          <select id="admin-dash-year" class="icon-select"></select>
          <select id="admin-dash-month" class="icon-select"></select>
          <a id="export-excel-btn" class="btn small secondary" data-t="export_excel_button" href="#" target="_blank" rel="noopener"></a>
        </div>
      </div>
      <div style="display:flex; align-items:center; justify-content:flex-end; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
        <span style="color:var(--text-muted); font-size:13px;">${t("filter_by_teammate_label")}</span>
        <div class="member-filter" id="admin-member-filter">
          <button type="button" class="member-filter-toggle" id="member-filter-toggle">
            <span id="member-filter-label">${t("all_team")}</span><span class="member-filter-caret">▾</span>
          </button>
          <div class="member-filter-panel hidden" id="member-filter-panel">
            <label class="member-filter-option">
              <input type="checkbox" id="member-filter-all" checked /> <strong>${t("all_team")}</strong>
            </label>
            <div class="member-filter-divider"></div>
            ${detail.members.map((m) => `
              <label class="member-filter-option">
                <input type="checkbox" class="member-filter-member" value="${m.id}" checked /> ${escapeHtml(m.full_name)}
              </label>
            `).join("")}
          </div>
        </div>
      </div>
      <div id="admin-dash-body"></div>
    </div>
  `;
  applyTranslations();

  // --- tracking mode toggle ---
  const modeButtons = document.querySelectorAll("#tracking-mode-toggle button");
  const currentMode = detail.team.track_weekends ? "all_week" : "weekdays";
  modeButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.mode === currentMode));
  modeButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const trackWeekends = btn.dataset.mode === "all_week";
      try {
        await apiPost("teams/set_tracking_mode.php", { team_id: teamId, track_weekends: trackWeekends });
        showToast(t("saved"));
        renderMain();
      } catch (err) {
        showToast(err.message || t("error_generic"));
      }
    });
  });

  // --- team settings: rename + description, with live name-uniqueness check ---
  const teamNameInput = document.getElementById("team-settings-name");
  const teamDescInput = document.getElementById("team-settings-desc");
  const nameCheckMsg = document.getElementById("team-name-check-msg");
  const saveTeamSettingsBtn = document.getElementById("save-team-settings-btn");
  const teamSettingsError = document.getElementById("team-settings-error");
  const originalTeamName = detail.team.name;
  let nameCheckDebounce = null;
  let nameIsAvailable = true; // the current saved name is trivially "available" until changed

  function updateSaveButtonState() {
    const name = teamNameInput.value.trim();
    saveTeamSettingsBtn.disabled = !name || !nameIsAvailable;
  }
  // Initial state: name is unchanged, so the button should already be
  // enabled — this only locks again if the person types a taken name.
  updateSaveButtonState();

  teamNameInput.addEventListener("input", () => {
    clearTimeout(nameCheckDebounce);
    const name = teamNameInput.value.trim();
    teamSettingsError.textContent = "";
    if (!name) {
      nameCheckMsg.textContent = "";
      nameCheckMsg.className = "";
      nameIsAvailable = false;
      updateSaveButtonState();
      return;
    }
    // Unchanged from the current saved name — no need to ask the server.
    if (name.toLowerCase() === originalTeamName.toLowerCase()) {
      nameCheckMsg.textContent = "";
      nameCheckMsg.className = "";
      nameIsAvailable = true;
      updateSaveButtonState();
      return;
    }
    nameCheckMsg.textContent = t("name_checking");
    nameCheckMsg.className = "";
    nameCheckDebounce = setTimeout(async () => {
      try {
        const res = await apiGet("teams/check_name.php", { name, team_id: teamId });
        nameIsAvailable = res.available;
        nameCheckMsg.textContent = t(res.available ? "name_available" : "name_taken");
        nameCheckMsg.className = res.available ? "success-msg" : "error-msg";
      } catch (err) {
        nameIsAvailable = false;
        nameCheckMsg.textContent = "";
      }
      updateSaveButtonState();
    }, 350);
  });

  saveTeamSettingsBtn.addEventListener("click", async () => {
    const name = teamNameInput.value.trim();
    teamSettingsError.textContent = "";
    if (!name) {
      teamSettingsError.textContent = t("name_required");
      return;
    }
    try {
      await apiPost("teams/update.php", { team_id: teamId, name, description: teamDescInput.value.trim() });
      showToast(t("saved"));
      renderMain();
    } catch (err) {
      teamSettingsError.textContent = err.message || t("error_generic");
    }
  });

  // --- join policy toggle (invite-only vs open — auto-saves like tracking mode) ---
  const joinPolicyButtons = document.querySelectorAll("#join-policy-toggle button");
  const currentJoinPolicy = detail.team.join_policy || "invite_only";
  joinPolicyButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.policy === currentJoinPolicy));
  joinPolicyButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await apiPost("teams/set_join_policy.php", { team_id: teamId, join_policy: btn.dataset.policy });
        showToast(t("saved"));
        renderMain();
      } catch (err) {
        showToast(err.message || t("error_generic"));
      }
    });
  });

  // --- auto-accept join requests toggle (only shown while join_policy is "open") ---
  const autoAcceptToggle = document.getElementById("auto-accept-toggle");
  if (autoAcceptToggle) {
    const autoAcceptButtons = autoAcceptToggle.querySelectorAll("button");
    const currentAutoAccept = detail.team.auto_accept_join_requests ? "1" : "0";
    autoAcceptButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.auto === currentAutoAccept));
    autoAcceptButtons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await apiPost("teams/set_auto_accept.php", { team_id: teamId, auto_accept: btn.dataset.auto === "1" });
          showToast(t("saved"));
          renderMain();
        } catch (err) {
          showToast(err.message || t("error_generic"));
        }
      });
    });
  }

  // --- join requests panel ---
  async function loadJoinRequests() {
    const box = document.getElementById("join-requests-list");
    try {
      const res = await apiGet("teams/join_requests_list.php", { team_id: teamId });
      if (!res.requests.length) {
        box.innerHTML = `<p style="color:var(--text-muted); font-size:13px;">${t("no_join_requests")}</p>`;
        return;
      }
      box.innerHTML = res.requests.map((r) => `
        <div class="invite-list-item">
          <div>
            <div style="font-weight:600;">${escapeHtml(r.full_name)}</div>
            <div style="font-size:12px; color:var(--text-muted);">${escapeHtml(r.email)} &middot; ${t("requested_on_label")} ${formatDateHuman(r.created_at.slice(0, 10))}</div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn small" data-action="approve" data-id="${r.id}">${t("join_request_accept")}</button>
            <button class="btn ghost small" data-action="reject" data-id="${r.id}">${t("join_request_reject")}</button>
          </div>
        </div>
      `).join("");
      box.querySelectorAll("button[data-action]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const requestId = parseInt(btn.dataset.id, 10);
          const action = btn.dataset.action;
          try {
            await apiPost("teams/join_requests_respond.php", { request_id: requestId, action: action === "approve" ? "approve" : "reject" });
            showToast(t(action === "approve" ? "join_request_approved_toast" : "join_request_rejected_toast"));
            if (action === "approve") {
              renderMain();
            } else {
              loadJoinRequests();
            }
          } catch (err) {
            showToast(err.message || t("error_generic"));
          }
        });
      });
    } catch (err) {
      box.innerHTML = "";
    }
  }
  loadJoinRequests();

  // --- invite: user search ---
  const searchInput = document.getElementById("invite-user-search");
  const resultsBox = document.getElementById("invite-user-results");
  const sendBtn = document.getElementById("send-invite-btn");

  searchInput.addEventListener("input", () => {
    clearTimeout(userSearchDebounce);
    const q = searchInput.value.trim();
    userSearchDebounce = setTimeout(async () => {
      if (!q) {
        resultsBox.classList.add("hidden");
        resultsBox.innerHTML = "";
        return;
      }
      try {
        const res = await apiGet("users/search.php", { team_id: teamId, q });
        renderUserSearchResults(res.users);
      } catch (err) {
        resultsBox.classList.add("hidden");
      }
    }, 250);
  });

  function renderUserSearchResults(users) {
    if (!users.length) {
      resultsBox.innerHTML = `<div class="user-search-result-item">${t("no_users_found")}</div>`;
      resultsBox.classList.remove("hidden");
      return;
    }
    resultsBox.innerHTML = users.map((u) => `
      <div class="user-search-result-item" data-id="${u.id}" data-name="${escapeHtml(u.full_name)}">
        <div>${escapeHtml(u.full_name)}</div>
        <div class="usr-email">${escapeHtml(u.email)}</div>
      </div>
    `).join("");
    resultsBox.classList.remove("hidden");
    resultsBox.querySelectorAll(".user-search-result-item[data-id]").forEach((item) => {
      item.addEventListener("click", () => {
        selectedInviteUser = { id: parseInt(item.dataset.id, 10), name: item.dataset.name };
        renderSelectedUser();
        resultsBox.classList.add("hidden");
        searchInput.value = "";
      });
    });
  }

  function renderSelectedUser() {
    const box = document.getElementById("selected-user-box");
    if (!selectedInviteUser) {
      box.innerHTML = "";
      sendBtn.disabled = true;
      return;
    }
    box.innerHTML = `
      <span class="selected-user-chip">
        ${escapeHtml(selectedInviteUser.name)}
        <button type="button" id="clear-selected-user">&times;</button>
      </span>
    `;
    sendBtn.disabled = false;
    document.getElementById("clear-selected-user").addEventListener("click", () => {
      selectedInviteUser = null;
      renderSelectedUser();
    });
  }

  sendBtn.addEventListener("click", async () => {
    if (!selectedInviteUser) return;
    const role = document.getElementById("invite-role").value;
    const errorEl = document.getElementById("invite-error");
    errorEl.textContent = "";
    try {
      await apiPost("teams/invite.php", { team_id: teamId, user_id: selectedInviteUser.id, role });
      showToast(t("invite_sent"));
      selectedInviteUser = null;
      renderSelectedUser();
      loadTeamPendingInvites();
    } catch (err) {
      errorEl.textContent = err.message || t("error_generic");
    }
  });

  async function loadTeamPendingInvites() {
    const box = document.getElementById("team-pending-invites");
    try {
      const res = await apiGet("invitations/list_for_team.php", { team_id: teamId });
      if (!res.invitations.length) {
        box.innerHTML = `<p style="color:var(--text-muted); font-size:13px;">—</p>`;
        return;
      }
      box.innerHTML = res.invitations.map((inv) => `
        <div class="invite-list-item">
          <div>
            <div style="font-weight:600;">${escapeHtml(inv.full_name)}</div>
            <div style="font-size:12px; color:var(--text-muted);">${escapeHtml(inv.email)} &middot; ${t("role_" + inv.role)}</div>
          </div>
          <button class="btn ghost small" data-cancel-id="${inv.id}">${t("cancel_invite")}</button>
        </div>
      `).join("");
      box.querySelectorAll("button[data-cancel-id]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          try {
            await apiPost("invitations/revoke.php", { invitation_id: parseInt(btn.dataset.cancelId, 10) });
            loadTeamPendingInvites();
          } catch (err) {
            showToast(err.message || t("error_generic"));
          }
        });
      });
    } catch (err) {
      box.innerHTML = "";
    }
  }
  loadTeamPendingInvites();

  // --- suggested days ---
  const sugBox = document.getElementById("suggested-days-box");
  DAY_KEYS.slice(0, maxDay + 1).forEach((key, i) => {
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" value="${i}" ${suggestedDows.has(i) ? "checked" : ""}/> ${t(key)}`;
    sugBox.appendChild(label);
  });
  document.getElementById("save-suggested-btn").addEventListener("click", async () => {
    const days = Array.from(sugBox.querySelectorAll("input:checked")).map((el) => parseInt(el.value, 10));
    try {
      await apiPost("teams/suggested_days_set.php", { team_id: teamId, days });
      showToast(t("saved"));
    } catch (err) {
      showToast(err.message || t("error_generic"));
    }
  });

  renderMembersList(detail.members, teamId, isOwner, isManager);

  // --- attendance dashboard: filter by teammate (multi-select checkbox dropdown) ---
  // Defaults to "All team" with every member checked, per the requested behavior.
  let selectedMemberIds = new Set(detail.members.map((m) => m.id));
  let lastAdminDashboardData = null;
  const memberNameById = {};
  detail.members.forEach((m) => { memberNameById[m.id] = m.full_name; });

  const memberFilterEl = document.getElementById("admin-member-filter");
  const memberFilterToggle = document.getElementById("member-filter-toggle");
  const memberFilterPanel = document.getElementById("member-filter-panel");
  const memberFilterLabel = document.getElementById("member-filter-label");
  const memberFilterAllCheckbox = document.getElementById("member-filter-all");
  const memberCheckboxes = Array.from(document.querySelectorAll(".member-filter-member"));

  memberFilterToggle.addEventListener("click", () => {
    memberFilterPanel.classList.toggle("hidden");
  });
  // Scoped to the tab container (not document) so this listener is thrown
  // away along with the rest of the admin tab's old DOM on every re-render,
  // instead of quietly stacking up a new document-level listener each time.
  container.addEventListener("click", (e) => {
    if (!memberFilterEl.contains(e.target)) memberFilterPanel.classList.add("hidden");
  });

  function updateMemberFilterLabel() {
    const total = memberCheckboxes.length;
    const selected = selectedMemberIds.size;
    if (selected === total) {
      memberFilterLabel.textContent = t("all_team");
    } else if (selected === 0) {
      memberFilterLabel.textContent = t("no_members_selected");
    } else if (selected === 1) {
      const onlyId = Array.from(selectedMemberIds)[0];
      memberFilterLabel.textContent = memberNameById[onlyId] || `${selected} ${t("teammates_selected_label")}`;
    } else {
      memberFilterLabel.textContent = `${selected} ${t("teammates_selected_label")}`;
    }
  }

  function refreshAdminDashboardFiltered() {
    if (lastAdminDashboardData) {
      renderAdminDashboard(lastAdminDashboardData, APP.adminDashboardYear, APP.adminDashboardMonth, selectedMemberIds);
    }
  }

  memberFilterAllCheckbox.addEventListener("change", () => {
    const checked = memberFilterAllCheckbox.checked;
    memberFilterAllCheckbox.indeterminate = false;
    memberCheckboxes.forEach((cb) => { cb.checked = checked; });
    selectedMemberIds = checked ? new Set(detail.members.map((m) => m.id)) : new Set();
    updateMemberFilterLabel();
    refreshAdminDashboardFiltered();
  });

  memberCheckboxes.forEach((cb) => {
    cb.addEventListener("change", () => {
      const id = parseInt(cb.value, 10);
      if (cb.checked) selectedMemberIds.add(id); else selectedMemberIds.delete(id);
      const allChecked = memberCheckboxes.every((c) => c.checked);
      const noneChecked = memberCheckboxes.every((c) => !c.checked);
      memberFilterAllCheckbox.checked = allChecked;
      memberFilterAllCheckbox.indeterminate = !allChecked && !noneChecked;
      updateMemberFilterLabel();
      refreshAdminDashboardFiltered();
    });
  });

  function updateExportLink(year, month) {
    const params = new URLSearchParams({ team_id: teamId, year });
    if (month) params.set("month", month);
    document.getElementById("export-excel-btn").href = `api/teams/dashboard_export.php?${params.toString()}`;
  }

  async function loadAdminDashboard(year, month) {
    const res = await apiGet("dashboard/manager.php", { team_id: teamId, year, month: month || "" });
    lastAdminDashboardData = res;
    renderAdminDashboard(res, year, month, selectedMemberIds);
    updateExportLink(year, month);
  }

  buildYearMonthSelectors(
    document.getElementById("admin-dash-year"),
    document.getElementById("admin-dash-month"),
    APP.adminDashboardYear,
    APP.adminDashboardMonth,
    (y, m) => {
      APP.adminDashboardYear = y;
      APP.adminDashboardMonth = m;
      loadAdminDashboard(y, m);
    }
  );

  await loadAdminDashboard(APP.adminDashboardYear, APP.adminDashboardMonth);
}

function renderMembersList(members, teamId, isOwner, isManager) {
  const list = document.getElementById("members-list");
  list.innerHTML = "";
  members.forEach((m) => {
    const row = document.createElement("div");
    row.className = "member-row";
    const roleControls = isOwner && m.role !== "owner" ? `
      <button class="btn ghost small" data-action="${m.role === "admin" ? "make_employee" : "make_admin"}" data-user="${m.id}">
        ${m.role === "admin" ? t("make_employee") : t("make_admin")}
      </button>
      <button class="btn danger small" data-action="remove" data-user="${m.id}" data-name="${escapeHtml(m.full_name)}">${t("remove_member")}</button>
    ` : "";
    // Any manager (owner or admin) can reset a teammate's password if they
    // get locked out — but never the owner's, and never their own (they'd
    // use My account or the forgot-password link for that).
    const canResetPassword = isManager && m.role !== "owner" && m.id !== APP.user.id;
    const passwordControl = canResetPassword ? `
      <button class="btn ghost small" data-action="reset_password" data-user="${m.id}" data-name="${escapeHtml(m.full_name)}">
        ${t("reset_password_button")}
      </button>
    ` : "";
    row.innerHTML = `
      <div>
        <div class="member-name">${escapeHtml(m.full_name)}</div>
        <div class="member-meta">${escapeHtml(m.email)}</div>
      </div>
      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
        <span class="role-badge ${m.role === "employee" ? "employee" : ""}">${t("role_" + m.role)}</span>
        ${passwordControl}
        ${roleControls}
      </div>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const userId = parseInt(btn.dataset.user, 10);
      const action = btn.dataset.action;
      if (action === "reset_password") {
        resetPasswordTarget = { teamId, userId, name: btn.dataset.name };
        document.getElementById("reset-password-target-name").textContent = btn.dataset.name;
        document.getElementById("reset-member-new-password").value = "";
        document.getElementById("reset-password-error").textContent = "";
        openModal("modal-reset-password");
        return;
      }
      if (action === "remove") {
        // Destructive + irreversible (it also wipes their attendance history
        // for this team), so this always goes through a confirm dialog first
        // instead of firing the API call right away.
        pendingRemoveMember = { teamId, userId, name: btn.dataset.name };
        document.getElementById("confirm-remove-member-name").textContent = btn.dataset.name;
        openModal("modal-confirm-remove-member");
        return;
      }
      try {
        await apiPost("teams/set_role.php", { team_id: teamId, user_id: userId, role: action === "make_admin" ? "admin" : "employee" });
        renderMain();
      } catch (err) {
        showToast(err.message || t("error_generic"));
      }
    });
  });
}

function renderAdminDashboard(data, year, month, selectedMemberIds) {
  const body = document.getElementById("admin-dash-body");
  const { from, to } = dashboardDateRange(year, month);

  // selectedMemberIds narrows both the calendar heatmap and the per-person
  // breakdown down to only the teammates checked in the filter dropdown —
  // "possible days" is left alone since that's about the team's tracked
  // schedule, not about who's currently selected.
  const members = selectedMemberIds ? data.members.filter((m) => selectedMemberIds.has(m.id)) : data.members;
  const attendance = selectedMemberIds ? data.attendance.filter((a) => selectedMemberIds.has(a.user_id)) : data.attendance;

  const trackWeekends = !!(APP.currentTeamDetail && APP.currentTeamDetail.team && APP.currentTeamDetail.team.track_weekends);
  const possibleDays = countApplicableDays(from, to, trackWeekends);
  const heatmapHtml = month
    ? `<div class="heatcal-wrap">${buildHeatmapCalendarHtml(attendance, year, month, trackWeekends)}</div>`
    : buildYearHeatmapCalendarsHtml(attendance, year, trackWeekends);

  const byMember = {};
  members.forEach((m) => { byMember[m.id] = { id: m.id, name: m.full_name, count: 0 }; });
  attendance.forEach((a) => {
    if (byMember[a.user_id]) byMember[a.user_id].count++;
  });
  const rows = Object.values(byMember)
    .map((r) => ({ ...r, percent: possibleDays ? Math.round((r.count / possibleDays) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  const periodLabel = month ? `${t(MONTH_KEYS[month - 1])} ${year}` : String(year);
  const teamTotal = rows.reduce((sum, r) => sum + r.count, 0);
  const teamAvgPercent = rows.length && possibleDays ? Math.round((teamTotal / (rows.length * possibleDays)) * 100) : 0;

  body.innerHTML = `
    ${heatmapHtml}
    <div class="heatmap-legend">
      <span>${t("days_attended")}:</span>
      <span class="heat-cell" data-level="0"></span>
      <span class="heat-cell" data-level="1"></span>
      <span class="heat-cell" data-level="2"></span>
      <span class="heat-cell" data-level="3"></span>
      <span class="heat-cell" data-level="4"></span>
    </div>

    <div class="dash-summary-row">
      <div class="dash-summary-stat">
        <div class="dash-summary-value">${possibleDays}</div>
        <div class="dash-summary-label">${t("possible_days_label")}</div>
      </div>
      <div class="dash-summary-stat">
        <div class="dash-summary-value">${teamAvgPercent}%</div>
        <div class="dash-summary-label">${t("team_average_label")}</div>
      </div>
      <div class="dash-summary-stat">
        <div class="dash-summary-value">${rows.length}</div>
        <div class="dash-summary-label">${t("members")}</div>
      </div>
    </div>

    <h3 style="margin-top:20px;">${t("per_person")} — ${escapeHtml(periodLabel)}</h3>
    ${rows.length ? rows.map((r) => `
      <div class="person-breakdown-row" data-user-id="${r.id}" data-user-name="${escapeHtml(r.name)}" title="${t("view_calendar_hint")}">
        <div class="person-breakdown-name">${escapeHtml(r.name)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, r.percent)}%;"></div></div>
        <div class="person-breakdown-stat">${r.count}/${possibleDays} <span class="person-breakdown-percent">(${r.percent}%)</span></div>
      </div>
    `).join("") : `<p style="color:var(--text-muted);">—</p>`}
  `;

  body.querySelectorAll(".person-breakdown-row[data-user-id]").forEach((row) => {
    row.addEventListener("click", () => {
      openPersonCalendarModal(parseInt(row.dataset.userId, 10), row.dataset.userName, year, month, data.attendance);
    });
  });
}

/**
 * Shared by the admin "Per person" breakdown and the personal dashboard's
 * "Teammates' attendance" list: clicking a person shows their attendance as
 * a full month calendar (same look as "My attendance"), so anyone can see at
 * a glance which days a teammate was actually in. Reuses whichever attendance
 * rows the caller already has loaded (attendanceRows) rather than firing a
 * new request — those rows are scoped to the same year/month range already
 * shown on screen.
 */
function openPersonCalendarModal(userId, name, year, month, attendanceRows) {
  if (!attendanceRows) return;

  // The breakdown can be viewed for a whole year (no month filter) — in that
  // case there's no single "selected month" to show, so default to the
  // current month if we're looking at the current year, otherwise December.
  let calMonth = month;
  if (!calMonth) {
    const today = new Date();
    calMonth = year === today.getFullYear() ? today.getMonth() + 1 : 12;
  }

  const trackWeekends = !!(APP.currentTeamDetail && APP.currentTeamDetail.team && APP.currentTeamDetail.team.track_weekends);
  const monthPrefix = `${year}-${String(calMonth).padStart(2, "0")}`;
  const checkedDates = new Set(
    attendanceRows
      .filter((a) => a.user_id === userId && a.attendance_date.slice(0, 7) === monthPrefix)
      .map((a) => a.attendance_date)
  );

  document.getElementById("person-cal-name").textContent = name;
  document.getElementById("person-cal-period").textContent = `${t(MONTH_KEYS[calMonth - 1])} ${year}`;
  document.getElementById("person-cal-body").innerHTML = `
    <div style="font-size:22px; font-weight:700; margin-bottom:6px;">${checkedDates.size} <span style="font-size:13px; color:var(--text-muted); font-weight:500;">${t("total_days_month")}</span></div>
    <div class="cal-wrap">${buildMonthCalendarHtml(checkedDates, year, calMonth, trackWeekends)}</div>
  `;
  openModal("modal-person-calendar");
}

/* --------------------------------- utils ---------------------------------------- */

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

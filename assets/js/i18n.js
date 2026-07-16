/* OfficePal i18n — English / Spanish dictionary + tiny translation helper. */

const DICT = {
  en: {
    app_name: "OfficePal",
    tagline: "Your friendly office attendance buddy",
    nav_teams: "My Teams",
    nav_dashboard: "My Dashboard",
    nav_invitations: "Invitations",
    nav_logout: "Log out",
    lang_label: "Language",
    theme_label: "Theme",

    // Auth
    login_tab: "Log in",
    register_tab: "Create account",
    email_label: "Email",
    password_label: "Password",
    full_name_label: "Your real name",
    full_name_hint: "So your managers know who's checking in.",
    login_button: "Log in",
    register_button: "Create my account",
    login_error: "Email or password is incorrect.",
    register_success: "Account created! Taking you inside...",
    already_have_account: "Already have an account?",
    need_account: "Need an account?",
    continue: "Continue",
    weak_password_error: "Password must be at least 8 characters.",

    // Forgot password / security question / account settings
    forgot_password_link: "Forgot your password?",
    forgot_password_title: "Forgot your password?",
    security_question_label: "Security question (optional)",
    security_question_hint: "If you forget your password, we'll ask you this to confirm it's really you.",
    security_question_placeholder: "e.g. What was your first pet's name?",
    security_answer_label: "Your answer",
    new_password_label: "New password",
    reset_password_button: "Reset password",
    no_security_question_msg: "This account doesn't have a security question set up. Ask a manager or admin of one of your teams to reset your password for you instead.",
    password_reset_success: "Password reset! You can log in with your new password now.",
    my_account_title: "My account",
    change_password_title: "Change password",
    current_password_label: "Current password",
    change_password_button: "Change password",
    password_changed_success: "Password changed!",
    security_question_title: "Security question",
    security_question_both_required: "Please fill in both the question and its answer.",
    reset_member_password_title: "Reset a teammate's password",
    reset_password_for_label: "Resetting password for",

    // Mascot messages
    mascot_welcome_1: "Hi, I'm Pal! Let's track your office days together.",
    mascot_welcome_2: "Every check-in makes your team happier to see you!",
    mascot_no_teams: "You're not on a team yet. Create one or wait for an invite!",
    mascot_checkin_thanks: "Yay! Thanks for coming in today!",
    mascot_encourage_1: "Coming to the office is more fun with friends nearby!",
    mascot_encourage_2: "Every day you show up counts. Keep it up!",

    // Teams
    create_team: "Create a team",
    team_name_label: "Team name",
    team_desc_label: "Description (optional)",
    create_team_button: "Create team",
    my_teams: "My teams",
    no_teams_yet: "No teams yet",
    members: "members",
    role_owner: "Manager",
    role_admin: "Admin",
    role_employee: "Employee",

    // Invitations — entirely in-app now, no email involved.
    invite_someone: "Invite someone",
    invite_search_hint: "Search for a teammate who already has an OfficePal account.",
    invite_search_placeholder: "Search by name or email...",
    no_users_found: "No matching users found.",
    invite_role_label: "Role",
    invite_button: "Send invitation",
    invite_sent: "Invitation sent!",
    pending_invitations: "Pending invitations",
    pending_invitations_sent: "Pending invitations sent",
    cancel_invite: "Cancel",
    invited_by_label: "Invited by",
    invite_accepted: "You joined the team!",
    invite_declined: "Invitation declined.",
    no_pending_invitations: "No pending invitations right now.",
    accept: "Accept",
    decline: "Decline",
    remove_member: "Remove",
    make_admin: "Make admin",
    make_employee: "Make employee",

    // Suggested / favorite days
    suggested_days_title: "Suggested office days",
    suggested_days_hint: "Pick the days you'd like the team to come in. Employees will see this as the recommendation for the week.",
    save_suggested_days: "Save suggested days",
    saved: "Saved!",
    favorite_days_title: "My favorite office days",
    favorite_days_hint: "Your own personal preference — doesn't have to match the manager's suggestion.",
    save_favorites: "Save my favorites",

    // Weekday / calendar tracking mode
    tracking_mode_title: "Days tracked",
    tracking_mode_hint: "Choose whether this team tracks Mon-Fri only or the full week — this hides the days you don't need everywhere in the app.",
    tracking_mode_weekdays: "Week days",
    tracking_mode_weekdays_desc: "Monday to Friday only",
    tracking_mode_all_week: "All week",
    tracking_mode_all_week_desc: "Monday to Sunday",

    // Week / attendance
    this_week: "This week",
    mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
    checked_in: "Checked in",
    tap_to_checkin: "Tap to check in",
    tap_to_undo: "Tap to undo",
    suggested_tag: "Suggested",
    favorite_tag: "Favorite",
    checkin_success: "Attendance logged. Have a great day at the office!",

    // Dashboards
    dashboard_title: "Attendance dashboard",
    year_label: "Year",
    team_overview: "Team overview",
    per_person: "Per person",
    days_attended: "days attended",
    team_members_attendance: "Teammates' attendance",
    my_attendance_title: "My attendance",
    total_days_year: "Total days this year",
    total_days_month: "days this month",
    no_attendance_this_period: "No attendance logged for this period yet.",
    this_month: "This month",
    possible_days_label: "Possible days",
    team_average_label: "Team average",
    view_calendar_hint: "Click to see this person's attendance calendar",
    month_all: "All months",
    month_jan: "Jan", month_feb: "Feb", month_mar: "Mar", month_apr: "Apr",
    month_may: "May", month_jun: "Jun", month_jul: "Jul", month_aug: "Aug",
    month_sep: "Sep", month_oct: "Oct", month_nov: "Nov", month_dec: "Dec",
    export_excel_button: "Download Excel",

    // Misc / errors
    loading: "Loading...",
    save: "Save",
    cancel: "Cancel",
    close: "Close",
    error_generic: "Something went wrong. Please try again.",
    not_authenticated: "Please log in to continue.",
    manager_area: "Admin area",
    weekly_pattern_note: "This applies every week until you change it.",
  },

  es: {
    app_name: "OfficePal",
    tagline: "Tu amigo simpático para la asistencia a la oficina",
    nav_teams: "Mis equipos",
    nav_dashboard: "Mi panel",
    nav_invitations: "Invitaciones",
    nav_logout: "Cerrar sesión",
    lang_label: "Idioma",
    theme_label: "Tema",

    login_tab: "Iniciar sesión",
    register_tab: "Crear cuenta",
    email_label: "Correo electrónico",
    password_label: "Contraseña",
    full_name_label: "Tu nombre real",
    full_name_hint: "Para que tus gerentes sepan quién está registrando asistencia.",
    login_button: "Iniciar sesión",
    register_button: "Crear mi cuenta",
    login_error: "El correo o la contraseña son incorrectos.",
    register_success: "¡Cuenta creada! Entrando...",
    already_have_account: "¿Ya tienes una cuenta?",
    need_account: "¿Necesitas una cuenta?",
    continue: "Continuar",
    weak_password_error: "La contraseña debe tener al menos 8 caracteres.",

    // Olvidé mi contraseña / pregunta de seguridad / ajustes de cuenta
    forgot_password_link: "¿Olvidaste tu contraseña?",
    forgot_password_title: "¿Olvidaste tu contraseña?",
    security_question_label: "Pregunta de seguridad (opcional)",
    security_question_hint: "Si olvidas tu contraseña, te haremos esta pregunta para confirmar que eres tú.",
    security_question_placeholder: "Ej.: ¿Cómo se llamaba tu primera mascota?",
    security_answer_label: "Tu respuesta",
    new_password_label: "Nueva contraseña",
    reset_password_button: "Restablecer contraseña",
    no_security_question_msg: "Esta cuenta no tiene una pregunta de seguridad configurada. Pide a un gerente o administrador de uno de tus equipos que te restablezca la contraseña.",
    password_reset_success: "¡Contraseña restablecida! Ya puedes iniciar sesión con tu nueva contraseña.",
    my_account_title: "Mi cuenta",
    change_password_title: "Cambiar contraseña",
    current_password_label: "Contraseña actual",
    change_password_button: "Cambiar contraseña",
    password_changed_success: "¡Contraseña actualizada!",
    security_question_title: "Pregunta de seguridad",
    security_question_both_required: "Completa tanto la pregunta como su respuesta.",
    reset_member_password_title: "Restablecer la contraseña de un compañero",
    reset_password_for_label: "Restableciendo la contraseña de",

    mascot_welcome_1: "¡Hola, soy Pal! Vamos a llevar el registro de tus días de oficina juntos.",
    mascot_welcome_2: "¡Cada registro hace más feliz a tu equipo de verte!",
    mascot_no_teams: "Todavía no perteneces a un equipo. ¡Crea uno o espera una invitación!",
    mascot_checkin_thanks: "¡Genial! ¡Gracias por venir hoy!",
    mascot_encourage_1: "¡Venir a la oficina es más divertido con tus compañeros cerca!",
    mascot_encourage_2: "Cada día que asistes cuenta. ¡Sigue así!",

    create_team: "Crear un equipo",
    team_name_label: "Nombre del equipo",
    team_desc_label: "Descripción (opcional)",
    create_team_button: "Crear equipo",
    my_teams: "Mis equipos",
    no_teams_yet: "Aún no tienes equipos",
    members: "miembros",
    role_owner: "Gerente",
    role_admin: "Administrador",
    role_employee: "Empleado",

    invite_someone: "Invitar a alguien",
    invite_search_hint: "Busca a un compañero que ya tenga una cuenta de OfficePal.",
    invite_search_placeholder: "Buscar por nombre o correo...",
    no_users_found: "No se encontraron usuarios que coincidan.",
    invite_role_label: "Rol",
    invite_button: "Enviar invitación",
    invite_sent: "¡Invitación enviada!",
    pending_invitations: "Invitaciones pendientes",
    pending_invitations_sent: "Invitaciones enviadas pendientes",
    cancel_invite: "Cancelar",
    invited_by_label: "Invitado por",
    invite_accepted: "¡Te uniste al equipo!",
    invite_declined: "Invitación rechazada.",
    no_pending_invitations: "No tienes invitaciones pendientes.",
    accept: "Aceptar",
    decline: "Rechazar",
    remove_member: "Eliminar",
    make_admin: "Hacer administrador",
    make_employee: "Hacer empleado",

    suggested_days_title: "Días sugeridos de oficina",
    suggested_days_hint: "Elige los días en que te gustaría que el equipo asista. Los empleados verán esto como la recomendación de la semana.",
    save_suggested_days: "Guardar días sugeridos",
    saved: "¡Guardado!",
    favorite_days_title: "Mis días favoritos de oficina",
    favorite_days_hint: "Tu preferencia personal — no tiene que coincidir con la sugerencia del gerente.",
    save_favorites: "Guardar mis favoritos",

    tracking_mode_title: "Días registrados",
    tracking_mode_hint: "Elige si este equipo registra solo de lunes a viernes o la semana completa — esto oculta los días que no necesitas en toda la app.",
    tracking_mode_weekdays: "Días laborables",
    tracking_mode_weekdays_desc: "Solo de lunes a viernes",
    tracking_mode_all_week: "Semana completa",
    tracking_mode_all_week_desc: "De lunes a domingo",

    this_week: "Esta semana",
    mon: "Lun", tue: "Mar", wed: "Mié", thu: "Jue", fri: "Vie", sat: "Sáb", sun: "Dom",
    checked_in: "Asistencia registrada",
    tap_to_checkin: "Toca para registrar asistencia",
    tap_to_undo: "Toca para deshacer",
    suggested_tag: "Sugerido",
    favorite_tag: "Favorito",
    checkin_success: "Asistencia registrada. ¡Que tengas un gran día en la oficina!",

    dashboard_title: "Panel de asistencia",
    year_label: "Año",
    team_overview: "Resumen del equipo",
    per_person: "Por persona",
    days_attended: "días asistidos",
    team_members_attendance: "Asistencia de compañeros",
    my_attendance_title: "Mi asistencia",
    total_days_year: "Total de días este año",
    total_days_month: "días este mes",
    no_attendance_this_period: "Aún no hay asistencia registrada para este período.",
    this_month: "Este mes",
    possible_days_label: "Días posibles",
    team_average_label: "Promedio del equipo",
    view_calendar_hint: "Haz clic para ver el calendario de asistencia de esta persona",
    month_all: "Todos los meses",
    month_jan: "Ene", month_feb: "Feb", month_mar: "Mar", month_apr: "Abr",
    month_may: "May", month_jun: "Jun", month_jul: "Jul", month_aug: "Ago",
    month_sep: "Sep", month_oct: "Oct", month_nov: "Nov", month_dec: "Dic",
    export_excel_button: "Descargar Excel",

    loading: "Cargando...",
    save: "Guardar",
    cancel: "Cancelar",
    close: "Cerrar",
    error_generic: "Algo salió mal. Inténtalo de nuevo.",
    not_authenticated: "Inicia sesión para continuar.",
    manager_area: "Área de administración",
    weekly_pattern_note: "Esto aplica cada semana hasta que lo cambies.",
  },
};

let currentLang = localStorage.getItem("officepal_lang") || "en";

function t(key) {
  return (DICT[currentLang] && DICT[currentLang][key]) || DICT.en[key] || key;
}

function setLang(lang) {
  currentLang = lang === "es" ? "es" : "en";
  localStorage.setItem("officepal_lang", currentLang);
  document.documentElement.setAttribute("lang", currentLang);
  applyTranslations();
}

function getLang() {
  return currentLang;
}

function applyTranslations() {
  document.querySelectorAll("[data-t]").forEach((el) => {
    const key = el.getAttribute("data-t");
    el.textContent = t(key);
  });
  document.querySelectorAll("[data-t-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", t(el.getAttribute("data-t-placeholder")));
  });
  document.dispatchEvent(new CustomEvent("officepal:lang-changed"));
}

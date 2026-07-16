/* OfficePal theme switcher — 3 selectable color schemes. */

const THEMES = ["sunrise", "forest", "midnight"];

function getTheme() {
  return localStorage.getItem("officepal_theme") || "sunrise";
}

function setTheme(theme) {
  if (!THEMES.includes(theme)) theme = "sunrise";
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("officepal_theme", theme);
  document.querySelectorAll(".theme-dot").forEach((dot) => {
    dot.classList.toggle("active", dot.dataset.theme === theme);
  });
}

function initTheme() {
  setTheme(getTheme());
}

// Theme toggle (light / dark) using localStorage

const THEME_KEY = "tazabolsyn_theme";

function applyTheme(theme) {
  const body = document.body;
  if (theme === "dark") {
    body.classList.add("dark-mode");
  } else {
    body.classList.remove("dark-mode");
  }
}

function getPreferredTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

function toggleTheme() {
  const current = getPreferredTheme();
  const next = current === "dark" ? "light" : "dark";
  setTheme(next);
}

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(getPreferredTheme());

  const toggleBtn = document.querySelector("[data-theme-toggle]");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      toggleTheme();
    });
  }
});




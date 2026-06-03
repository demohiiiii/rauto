const DASHBOARD_BOOTSTRAP_KEY = "__rautoDashboardBootstrapped";

export function isDashboardRuntimeBootstrapped() {
  return !!window[DASHBOARD_BOOTSTRAP_KEY];
}

export function markDashboardRuntimeBootstrapped() {
  window[DASHBOARD_BOOTSTRAP_KEY] = true;
}

export function applyDashboardBodyShell() {
  document.body.className = "dashboard-body";
}

export function applyInitialTheme() {
  try {
    const themePreference = localStorage.getItem("rauto_theme") || "system";
    const initialTheme =
      themePreference === "light" || themePreference === "dark"
        ? themePreference
        : window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    document.body.setAttribute("data-dashboard-theme", initialTheme);
    document.body.setAttribute("data-theme", initialTheme);
  } catch (_) {
    // Keep the dashboard usable if localStorage is unavailable.
  }
}

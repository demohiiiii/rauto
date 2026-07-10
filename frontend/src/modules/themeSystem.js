import {
  prefersDarkColorScheme,
  storageGet,
  storageSet,
} from "../lib/browser.js";

export const themeModeOptions = ["system", "light", "dark"];
export const themePresetOptions = [
  "emerald",
  "neutral",
  "blue",
  "rose",
  "violet",
];
export const themeRadiusOptions = ["none", "sm", "md", "lg", "xl", "full"];

export const defaultThemeSettings = {
  mode: "system",
  preset: "emerald",
  radius: "lg",
};

const storageKeys = {
  mode: "rauto_theme_mode",
  preset: "rauto_theme_preset",
  radius: "rauto_theme_radius",
};

function optionOrDefault(value, options, fallback) {
  const normalized = String(value || "").trim();
  return options.includes(normalized) ? normalized : fallback;
}

export function normalizeThemeSettings(settings = {}) {
  return {
    mode: optionOrDefault(
      settings.mode,
      themeModeOptions,
      defaultThemeSettings.mode,
    ),
    preset: optionOrDefault(
      settings.preset,
      themePresetOptions,
      defaultThemeSettings.preset,
    ),
    radius: optionOrDefault(
      settings.radius,
      themeRadiusOptions,
      defaultThemeSettings.radius,
    ),
  };
}

function readStoredThemeSettings(storage = null) {
  const read = storage
    ? (key) => storage.getItem(key)
    : (key) => storageGet(key);
  return normalizeThemeSettings({
    mode: read(storageKeys.mode),
    preset: read(storageKeys.preset),
    radius: read(storageKeys.radius),
  });
}

function persistThemeSettings(settings, storage = null) {
  const write = storage
    ? (key, value) => storage.setItem(key, value)
    : (key, value) => storageSet(key, value);
  write(storageKeys.mode, settings.mode);
  write(storageKeys.preset, settings.preset);
  write(storageKeys.radius, settings.radius);
}

export function resolveThemeMode(mode, prefersDark = prefersDarkColorScheme) {
  const normalizedMode = optionOrDefault(
    mode,
    themeModeOptions,
    defaultThemeSettings.mode,
  );
  if (normalizedMode !== "system") return normalizedMode;
  return prefersDark() ? "dark" : "light";
}

function defaultDomAdapter() {
  if (typeof document === "undefined") return null;
  return {
    setDarkMode(enabled) {
      document.documentElement.classList.toggle("dark", !!enabled);
      document.body?.classList?.toggle("dark", !!enabled);
    },
    setAttribute(name, value) {
      document.documentElement.setAttribute(name, value);
    },
  };
}

export function applyThemeSettings(
  settings = {},
  { adapter = defaultDomAdapter() } = {},
) {
  const normalized = normalizeThemeSettings(settings);
  const resolvedMode = resolveThemeMode(normalized.mode);
  if (!adapter) return normalized;
  adapter.setDarkMode(resolvedMode === "dark");
  adapter.setAttribute("data-rauto-theme-preset", normalized.preset);
  adapter.setAttribute("data-rauto-radius", normalized.radius);
  return normalized;
}

export function updateThemeSettings(
  currentSettings = {},
  patch = {},
  { storage = null, persist = true } = {},
) {
  const baseSettings = Object.keys(currentSettings || {}).length
    ? normalizeThemeSettings(currentSettings)
    : readStoredThemeSettings(storage);
  const nextSettings = normalizeThemeSettings({ ...baseSettings, ...patch });
  if (persist) persistThemeSettings(nextSettings, storage);
  return nextSettings;
}

export function loadThemeSettings({ storage = null } = {}) {
  return readStoredThemeSettings(storage);
}

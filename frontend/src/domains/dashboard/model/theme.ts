import {
  prefersDarkColorScheme,
  storageGet,
  storageSet,
} from "../../../lib/browser.js";
import type {
  DashboardThemeDomAdapter,
  DashboardThemeMode,
  DashboardThemeSettings,
  DashboardThemeSettingsInput,
  DashboardThemeStorage,
  ResolvedDashboardThemeMode,
} from "./types.js";

export const themeModeOptions: readonly DashboardThemeMode[] = [
  "system",
  "light",
  "dark",
];

export const defaultThemeSettings: DashboardThemeSettings = {
  mode: "system",
  preset: "emerald",
  radius: "md",
};

const storageKeys = {
  mode: "rauto_theme_mode",
  preset: "rauto_theme_preset",
  radius: "rauto_theme_radius",
};

function optionOrDefault<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T,
): T {
  const normalized = String(value || "").trim();
  return options.includes(normalized as T) ? (normalized as T) : fallback;
}

function fixedPresetForMode(
  mode: DashboardThemeMode | ResolvedDashboardThemeMode,
): DashboardThemeSettings["preset"] {
  return mode === "dark" ? "violet" : "emerald";
}

export function normalizeThemeSettings(
  settings: DashboardThemeSettingsInput | null | undefined = {},
): DashboardThemeSettings {
  const input = settings ?? {};
  const mode = optionOrDefault(
    input.mode,
    themeModeOptions,
    defaultThemeSettings.mode,
  );
  return {
    mode,
    preset: fixedPresetForMode(mode),
    radius: "md",
  };
}

function readStoredThemeSettings(
  storage: DashboardThemeStorage | null = null,
): DashboardThemeSettings {
  const read = storage
    ? (key: string) => storage.getItem(key)
    : (key: string) => storageGet(key);
  return normalizeThemeSettings({
    mode: read(storageKeys.mode),
  });
}

function persistThemeSettings(
  settings: DashboardThemeSettings,
  storage: DashboardThemeStorage | null = null,
): void {
  const write = storage
    ? (key: string, value: string) => storage.setItem(key, value)
    : (key: string, value: string) => storageSet(key, value);
  write(storageKeys.mode, settings.mode);
  write(storageKeys.preset, settings.preset);
  write(storageKeys.radius, settings.radius);
}

export function resolveThemeMode(
  mode: unknown,
  prefersDark: () => boolean = prefersDarkColorScheme,
): ResolvedDashboardThemeMode {
  const normalizedMode = optionOrDefault(
    mode,
    themeModeOptions,
    defaultThemeSettings.mode,
  );
  if (normalizedMode !== "system") return normalizedMode;
  return prefersDark() ? "dark" : "light";
}

function defaultDomAdapter(): DashboardThemeDomAdapter | null {
  if (typeof document === "undefined") return null;
  return {
    setDarkMode(enabled: boolean) {
      document.documentElement.classList.toggle("dark", !!enabled);
      document.body?.classList?.toggle("dark", !!enabled);
    },
    setAttribute(name: string, value: string) {
      document.documentElement.setAttribute(name, value);
    },
  };
}

export function applyThemeSettings(
  settings: DashboardThemeSettingsInput = {},
  {
    adapter = defaultDomAdapter(),
  }: { adapter?: DashboardThemeDomAdapter | null } = {},
): DashboardThemeSettings {
  const normalized = normalizeThemeSettings(settings);
  const resolvedMode = resolveThemeMode(normalized.mode);
  const resolvedSettings: DashboardThemeSettings = {
    ...normalized,
    preset: fixedPresetForMode(resolvedMode),
    radius: "md",
  };
  if (!adapter) return resolvedSettings;
  adapter.setDarkMode(resolvedMode === "dark");
  adapter.setAttribute("data-rauto-theme-preset", resolvedSettings.preset);
  adapter.setAttribute("data-rauto-radius", resolvedSettings.radius);
  return resolvedSettings;
}

export function updateThemeSettings(
  currentSettings: DashboardThemeSettingsInput | null = {},
  patch: DashboardThemeSettingsInput = {},
  {
    storage = null,
    persist = true,
  }: { storage?: DashboardThemeStorage | null; persist?: boolean } = {},
): DashboardThemeSettings {
  const baseSettings = Object.keys(currentSettings || {}).length
    ? normalizeThemeSettings(currentSettings)
    : readStoredThemeSettings(storage);
  const nextSettings = normalizeThemeSettings({ ...baseSettings, ...patch });
  if (persist) persistThemeSettings(nextSettings, storage);
  return nextSettings;
}

export function loadThemeSettings({
  storage = null,
}: { storage?: DashboardThemeStorage | null } = {}): DashboardThemeSettings {
  return readStoredThemeSettings(storage);
}

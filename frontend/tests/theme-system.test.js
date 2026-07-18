import assert from "node:assert/strict";
import test from "node:test";
import {
  applyThemeSettings,
  defaultThemeSettings,
  normalizeThemeSettings,
  updateThemeSettings,
} from "../src/modules/themeSystem.js";

function memoryStorage(initial = {}) {
  const values = { ...initial };
  return {
    getItem(key) {
      return Object.hasOwn(values, key) ? values[key] : null;
    },
    setItem(key, value) {
      values[key] = String(value);
    },
    values,
  };
}

test("normalizes missing and invalid theme settings", () => {
  assert.deepEqual(normalizeThemeSettings({}), defaultThemeSettings);
  assert.deepEqual(
    normalizeThemeSettings({
      mode: "weird",
      preset: "lava",
      radius: "huge",
    }),
    defaultThemeSettings,
  );
});

test("loads valid persisted theme settings", () => {
  const storage = memoryStorage({
    rauto_theme_mode: "dark",
    rauto_theme_preset: "blue",
    rauto_theme_radius: "sm",
  });
  assert.deepEqual(updateThemeSettings({}, {}, { storage }), {
    mode: "dark",
    preset: "violet",
    radius: "md",
  });
});

test("updates and persists theme settings", () => {
  const storage = memoryStorage();
  const next = updateThemeSettings(
    { mode: "system", preset: "emerald", radius: "lg" },
    { mode: "dark", preset: "rose", radius: "full" },
    { storage },
  );
  assert.deepEqual(next, { mode: "dark", preset: "violet", radius: "md" });
  assert.equal(storage.values.rauto_theme_mode, "dark");
  assert.equal(storage.values.rauto_theme_preset, "violet");
  assert.equal(storage.values.rauto_theme_radius, "md");
});

test("applies theme settings to a DOM adapter", () => {
  const calls = [];
  const adapter = {
    setDarkMode(enabled) {
      calls.push(["dark", enabled]);
    },
    setAttribute(name, value) {
      calls.push(["attr", name, value]);
    },
  };
  applyThemeSettings(
    { mode: "dark", preset: "emerald", radius: "none" },
    { adapter },
  );
  assert.deepEqual(calls, [
    ["dark", true],
    ["attr", "data-rauto-theme-preset", "violet"],
    ["attr", "data-rauto-radius", "md"],
  ]);
});

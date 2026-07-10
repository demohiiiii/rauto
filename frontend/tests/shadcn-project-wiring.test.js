import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("shadcn project wiring exists", () => {
  assert.equal(existsSync("components.json"), true);
  assert.equal(existsSync("frontend/src/lib/utils.js"), true);
  assert.equal(
    existsSync("frontend/src/lib/components/ui/button/index.js"),
    true,
  );
});

test("components.json uses project-local aliases", () => {
  const config = JSON.parse(readFileSync("components.json", "utf8"));
  assert.equal(config.aliases.lib, "$lib");
  assert.equal(config.aliases.ui, "$lib/components/ui");
  assert.equal(config.aliases.components, "$lib/components");
});

test("vite exposes $lib alias for shadcn imports", () => {
  const source = readFileSync("vite.config.js", "utf8");
  assert.match(source, /alias:/);
  assert.match(source, /(?:["']\$lib["']|\$lib):/);
  assert.match(source, /frontend\/src\/lib/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(path, "utf8");
}

test("npm exposes repository-wide format check scripts", () => {
  const packageJson = JSON.parse(read("package.json"));

  assert.equal(
    packageJson.scripts["format:check"],
    "cargo fmt --all --check && npm run frontend:format:check",
  );
  assert.equal(
    packageJson.scripts["frontend:format:check"],
    'prettier --check "frontend/**/*.{js,mjs,svelte,css,html}" package.json vite.config.js',
  );
});

test("ci runs npm format check before building", () => {
  const ciWorkflow = read(".github/workflows/ci.yml");

  assert.match(ciWorkflow, /run: npm run format:check/);
  assert.doesNotMatch(ciWorkflow, /run: cargo fmt --all --check/);
  assert.ok(
    ciWorkflow.indexOf("run: npm run format:check") <
      ciWorkflow.indexOf("run: npm run web:build"),
  );
});

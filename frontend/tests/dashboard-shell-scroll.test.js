import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("desktop dashboard keeps sidebar fixed and scrolls main content", () => {
  const bodySource = readFileSync(
    "frontend/src/components/layout/DashboardBody.svelte",
    "utf8",
  );
  const cssSource = readFileSync("frontend/src/app.css", "utf8");

  assert.match(bodySource, /lg:h-dvh/);
  assert.match(bodySource, /lg:overflow-hidden/);
  assert.match(bodySource, /lg:h-dvh lg:min-h-0/);
  assert.match(bodySource, /lg:overflow-y-auto/);
  assert.match(bodySource, /lg:overscroll-contain/);
  assert.doesNotMatch(cssSource, /\.main-scroll\b/);
});

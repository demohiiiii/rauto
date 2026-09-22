import assert from "node:assert/strict";
import test from "node:test";
import { interactiveAccentColor } from "../src/domains/command/index.js";

test("interactive command item accents provide six distinct cycling colors", () => {
  const colors = Array.from({ length: 6 }, (_, itemIndex) =>
    interactiveAccentColor(itemIndex),
  );

  assert.equal(new Set(colors).size, 6);
  assert.equal(interactiveAccentColor(6), colors[0]);
  assert.equal(interactiveAccentColor(-1), colors[5]);
});

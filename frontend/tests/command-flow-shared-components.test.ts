import assert from "node:assert/strict";
import test from "node:test";
import { commandFlowAccentColor } from "../src/domains/command/index.js";

test("command flow item accents provide six distinct cycling colors", () => {
  const colors = Array.from({ length: 6 }, (_, itemIndex) =>
    commandFlowAccentColor(itemIndex),
  );

  assert.equal(new Set(colors).size, 6);
  assert.equal(commandFlowAccentColor(6), colors[0]);
  assert.equal(commandFlowAccentColor(-1), colors[5]);
});

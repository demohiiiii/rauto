import assert from "node:assert/strict";
import test from "node:test";

import { get } from "svelte/store";
import { createKeyedListState } from "../src/lib/svelte.js";

test("keyed list state isolates keys and publishes one aggregate store", () => {
  const changes = [];
  const lists = createKeyedListState(["first", "second"], {
    normalizeKey: (key) => String(key || "").trim(),
    onChange: (key) => changes.push(key),
  });

  lists.set(" first ", ["alpha"]);
  lists.update("second", (rows) => [...rows, "beta"]);

  assert.deepEqual(get(lists.rowsState), {
    first: ["alpha"],
    second: ["beta"],
  });
  assert.deepEqual(changes, ["first", "second"]);
  assert.equal(lists.has(" first "), true);
});

test("keyed list state normalizes invalid list values", () => {
  const lists = createKeyedListState(["items"]);

  lists.set("items", null);
  lists.update("items", () => "invalid");

  assert.deepEqual(get(lists.stateFor("items")), []);
});

import assert from "node:assert/strict";
import test from "node:test";

import { tabListSelectionBindings } from "../src/lib/events.js";

test("rejected tabs roll back and can select the repaired target again", () => {
  let activeValue = "json";
  let selectedValue = activeValue;
  let validJson = false;
  const selections: string[] = [];
  const bindings = tabListSelectionBindings({
    getActiveValue: () => activeValue,
    onSelect(nextValue) {
      selections.push(nextValue);
      if (!validJson) return false;
      activeValue = nextValue;
      return true;
    },
    onSelectedValueChange(nextValue) {
      selectedValue = nextValue;
    },
  });

  function clickTab(nextValue: string): void {
    if (selectedValue === nextValue) return;
    selectedValue = nextValue;
    bindings.valueChangeHandler(nextValue);
  }

  clickTab("form");
  assert.equal(selectedValue, "json");
  assert.deepEqual(selections, ["form"]);

  validJson = true;
  clickTab("form");
  assert.equal(selectedValue, "form");
  assert.deepEqual(selections, ["form", "form"]);
});

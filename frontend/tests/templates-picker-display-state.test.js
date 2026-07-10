import test from "node:test";
import assert from "node:assert/strict";
import { get, writable } from "svelte/store";
import { templateEditorPanelDisplayStores } from "../src/modules/templatesPanelDisplayState.js";

test("template editor picker display store always provides picker-safe fields", () => {
  const panelDisplayStateStore = writable({
    errorMessage: "",
    names: ["alpha"],
    selectedName: "alpha",
    title: "Templates",
  });

  const { pickerDisplayStateStore } = templateEditorPanelDisplayStores(
    panelDisplayStateStore,
  );
  const pickerDisplay = get(pickerDisplayStateStore);

  assert.equal(Array.isArray(pickerDisplay.selectOptionRows), true);
  assert.equal(Array.isArray(pickerDisplay.resourceItems), true);
  assert.equal(typeof pickerDisplay.emptyStatus?.message, "string");
  assert.equal(typeof pickerDisplay.emptyStatus?.tone, "string");
  assert.equal(pickerDisplay.selectedName, "alpha");
  assert.equal(pickerDisplay.hasItems, true);
});

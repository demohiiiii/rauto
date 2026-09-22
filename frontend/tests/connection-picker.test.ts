import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";
import {
  CONNECTION_PICKER,
  connectionPickerChoices,
  connectionPickerState,
  connectionPickerValues,
  setConnectionInventorySnapshots,
  setConnectionPickerSavedConnections,
  setConnectionPickerSelectedValues,
} from "../src/domains/connections/application/connectionFieldStoreState.js";
import { createConnectionPickerFieldWorkspace } from "../src/domains/connections/application/connectionFieldState.js";

const devices = [
  { name: "edge-a", host: "192.0.2.1", device_profile: "cisco_ios" },
  { name: "edge-b", host: "192.0.2.2", device_profile: "huawei_vrp" },
];

test("device options search names, IP addresses and profiles and retain selected rows for toggling", (t) => {
  setConnectionPickerSavedConnections(devices);
  t.after(() => setConnectionPickerSavedConnections([]));
  const key = CONNECTION_PICKER.batchExecTargets;
  for (const query of ["edge-b", "192.0.2.2", "HUAWEI"]) {
    const rows = connectionPickerChoices(
      key,
      { query, values: ["edge-b"] },
      { includeSelected: true },
    ).optionRows;
    assert.deepEqual(
      rows?.map((row) => row.value),
      ["edge-b"],
    );
    assert.equal(rows?.[0].description, "192.0.2.2 · huawei_vrp");
  }
  assert.deepEqual(
    connectionPickerChoices(key, { values: ["edge-b"] }).options,
    ["edge-a"],
  );
  assert.equal(
    connectionPickerChoices(key, { query: "missing" }).showNoMatch,
    true,
  );
  // A saved selection remains removable even after inventory refresh removes it.
  setConnectionPickerSavedConnections([]);
  assert.deepEqual(
    connectionPickerChoices(
      key,
      { values: ["edge-b"] },
      { includeSelected: true },
    ).options,
    ["edge-b"],
  );
});

test("picker selection, clearing and search remain synchronized with the shared store", (t) => {
  const key = CONNECTION_PICKER.batchExecTargets;
  setConnectionPickerSavedConnections(devices);
  setConnectionPickerSelectedValues(key, []);
  const changes: string[][] = [];
  const workspace = createConnectionPickerFieldWorkspace();
  let active = true;
  const sync = () =>
    workspace.setFieldContext({
      keyName: key,
      labelText: "Devices",
      pickerPlaceholder: "Select devices",
      active,
      onSelectionChange: (values) => changes.push(values),
      pickerState: get(connectionPickerState(key)),
    });
  const unsubscribe = connectionPickerState(key).subscribe(sync);
  t.after(() => {
    unsubscribe();
    setConnectionPickerSelectedValues(key, []);
    setConnectionPickerSavedConnections([]);
  });
  workspace.setOpen(true);
  workspace.handleQueryInput("192.0.2.2");
  assert.deepEqual(
    get(workspace.pickerDisplayStateStore).optionRows.map((row) => row.value),
    ["edge-b"],
  );
  workspace.setSelectedValues(["edge-b"]);
  assert.deepEqual(connectionPickerValues(key), ["edge-b"]);
  let display = get(workspace.pickerDisplayStateStore);
  assert.equal(display.query, "");
  assert.equal(display.pickerField.placeholder, "");
  assert.equal(display.pickerField.ariaLabelText, "Select devices");
  assert.equal(display.optionRows.length, 2);
  workspace.handleQueryInput("edge");
  workspace.setOpen(false);
  assert.equal(get(workspace.pickerDisplayStateStore).open, false);
  assert.equal(get(workspace.pickerDisplayStateStore).query, "");
  workspace.setSelectedValues([]);
  display = get(workspace.pickerDisplayStateStore);
  assert.equal(display.pickerField.placeholder, "Select devices");
  assert.deepEqual(changes, [["edge-b"], []]);
  active = false;
  sync();
  workspace.setOpen(true);
  workspace.setSelectedValues(["edge-a"]);
  assert.equal(get(workspace.pickerDisplayStateStore).open, false);
  assert.deepEqual(connectionPickerValues(key), []);
  assert.equal(changes.length, 2);
});

test("custom labels do not duplicate existing selections or bypass restricted picker rules", (t) => {
  setConnectionInventorySnapshots({
    labels: [{ name: "production" }],
    groups: [{ name: "branch" }],
  });
  t.after(() => setConnectionInventorySnapshots());
  assert.equal(
    connectionPickerChoices(
      CONNECTION_PICKER.savedLabels,
      { query: "new-tag" },
      { includeSelected: true },
    ).canAddCustom,
    true,
  );
  assert.equal(
    connectionPickerChoices(
      CONNECTION_PICKER.savedLabels,
      { query: "production", values: ["production"] },
      { includeSelected: true },
    ).canAddCustom,
    false,
  );
  assert.equal(
    connectionPickerChoices(
      CONNECTION_PICKER.orchestrationTargetTags,
      { query: "new-tag" },
      { includeSelected: true },
    ).canAddCustom,
    false,
  );
  assert.equal(
    connectionPickerChoices(
      CONNECTION_PICKER.savedGroups,
      { query: "new-group" },
      { includeSelected: true },
    ).canAddCustom,
    false,
  );
});

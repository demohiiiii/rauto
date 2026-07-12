import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as eventBindings from "../src/lib/events.js";

const read = (path) => readFileSync(path, "utf8");

test("transaction JSON editor applies untracked canonical context before connecting", () => {
  const source = read("frontend/src/pages/orchestrated/TxJsonEditor.svelte");

  assert.match(source, /import \{ untrack \} from "svelte"/);
  assert.match(
    source,
    /const initialEditorContext = untrack\(\(\) => \(\{\s*editorKey,\s*onInput,\s*value,\s*\}\)\)/,
  );
  assert.match(source, /createTxJsonEditorWorkspace\(initialEditorContext\)/);
  assert.match(source, /let connectedValue = initialEditorContext\.value/);
  assert.ok(
    source.indexOf("createTxJsonEditorWorkspace(initialEditorContext)") <
      source.indexOf("editorWorkspace.editorTextStore"),
  );
  const connectionEffect = source.match(
    /\$effect\(\(\) => \{[\s\S]*?return editorWorkspace\.connectHost\(\);[\s\S]*?\}\);/,
  )?.[0];
  assert.ok(connectionEffect);
  assert.match(connectionEffect, /if \(!active\) return/);
  assert.match(connectionEffect, /untrack\(\(\) => value\)/);
  assert.match(connectionEffect, /editorKey/);
  assert.match(connectionEffect, /onInput/);
  assert.match(connectionEffect, /value: connectionValue/);
  assert.ok(
    connectionEffect.indexOf("editorWorkspace.setEditorContext") <
      connectionEffect.indexOf("editorWorkspace.connectHost"),
  );
  assert.match(
    source,
    /if \(value === connectedValue\) return;[\s\S]*?editorWorkspace\.setEditorContext\(\{ value \}\)/,
  );
});

test("transaction JSON/Form surface exposes sync status and invalid JSON detail", () => {
  const source = read(
    "frontend/src/pages/orchestrated/TxJsonFormSurface.svelte",
  );

  assert.match(source, /ui\/badge/);
  assert.match(source, /callIfFunction/);
  assert.match(source, /formErrorDetail = null/);
  assert.match(source, /syncStatus = "synced"/);
  assert.match(source, /syncStatusText = ""/);
  assert.match(source, /syncStatusTone/);
  assert.match(source, /<Badge[^>]+role="status"/s);
  assert.match(source, /txEditorErrorLocation/);
  assert.match(source, /formErrorDetail\.line/);
  assert.match(source, /formErrorDetail\.column/);
});

test("transaction JSON/Form surface omits an empty sync status badge", () => {
  const source = read(
    "frontend/src/pages/orchestrated/TxJsonFormSurface.svelte",
  );

  assert.match(
    source,
    /\{#if syncStatusText\}\s*<Badge[^>]+role="status"[^>]*>.*?<\/Badge\s*>\s*\{\/if\}/s,
  );
});

test("rejected Form selection keeps and refocuses the JSON editor", () => {
  const source = read(
    "frontend/src/pages/orchestrated/TxJsonFormSurface.svelte",
  );

  assert.match(source, /function selectEditorView/);
  assert.match(source, /onSelect=\{selectEditorView\}/);
  assert.match(source, /let editorHost = \$state\(\)/);
  assert.match(source, /bind:this=\{editorHost\}/);
  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /\.cm-content, \[contenteditable="true"\], textarea/);
  assert.match(source, /\.focus\(\)/);
  assert.doesNotMatch(source, /onSelect=\{onEditorViewSelect\}/);
});

test("rejected tabs roll back and can select the repaired target again", () => {
  const source = read("frontend/src/components/fragments/TabList.svelte");
  assert.equal(typeof eventBindings.tabListSelectionBindings, "function");

  let activeValue = "json";
  let selectedValue = activeValue;
  let validJson = false;
  const selections = [];
  const bindings = eventBindings.tabListSelectionBindings({
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
  const clickTab = (nextValue) => {
    if (selectedValue === nextValue) return;
    selectedValue = nextValue;
    bindings.valueChangeHandler(nextValue);
  };

  clickTab("form");
  assert.equal(selectedValue, "json");
  assert.deepEqual(selections, ["form"]);

  validJson = true;
  clickTab("form");
  assert.equal(selectedValue, "form");
  assert.deepEqual(selections, ["form", "form"]);

  assert.match(source, /import \{ untrack \} from "svelte"/);
  assert.match(
    source,
    /let selectedValue = \$state\(untrack\(\(\) => activeValue\)\)/,
  );
  assert.match(
    source,
    /\$effect\(\(\) => \{\s*selectedValue = activeValue;\s*\}\)/,
  );
  assert.match(source, /<Tabs\.Root[\s\S]*bind:value=\{selectedValue\}/);
  assert.match(source, /tabListSelectionBindings/);
});

test("canonical transaction panels pass detail and localized sync presentation", () => {
  for (const panelPath of [
    "frontend/src/pages/orchestrated/TxBlockInputPanel.svelte",
    "frontend/src/pages/orchestrated/TxWorkflowInputPanel.svelte",
  ]) {
    const source = read(panelPath);

    assert.match(source, /formErrorDetailStateStore/);
    assert.match(source, /syncStatusStateStore/);
    assert.match(source, /transactionEditorSyncPresentation/);
    assert.match(source, /formErrorDetail=/);
    assert.match(source, /syncStatus=/);
    assert.match(source, /syncStatusText=/);
    assert.match(source, /syncStatusTone=/);
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";

import {
  createTxVarsAssistantCardWorkspace,
  requiredTxVarsAssistantConfigByPrefix,
  setTxVarsRawText,
  TX_VARS,
  txVarsAssistantStateFor,
  txVarsTextStateFor,
} from "../src/domains/transactions/index.js";
import { createTxDirectVarsPanelWorkspace } from "../src/domains/transactions/index.js";

test("transaction vars form and JSON stay synchronized", () => {
  const panel = createTxDirectVarsPanelWorkspace({
    getPanelConfig: () => ({ varsKey: TX_VARS.txBlockDirect }),
  });
  const form = createTxVarsAssistantCardWorkspace({
    getPrefix: () => "tx-block-direct",
  });

  setTxVarsRawText(TX_VARS.txBlockDirect, '{"device":"edge-1"}', {
    source: "editor",
  });
  form.setAssistantCardContext({
    active: true,
    prefix: "tx-block-direct",
  });

  let row = get(form.assistantDisplayStateStore).assistantEntryInputRows[0];
  assert.equal(row.keyValue, "device");
  assert.equal(row.valueText, "edge-1");

  const actions = get(form.assistantActionsStateStore);
  actions.updateEntryKey(row.entryId)("target");
  actions.updateEntryValue(row.entryId)("edge-2");

  assert.deepEqual(JSON.parse(get(panel.panelDisplayStateStore).varsText), {
    target: "edge-2",
  });

  setTxVarsRawText(TX_VARS.txBlockDirect, '{"attempts":3}', {
    source: "editor",
  });
  row = get(form.assistantDisplayStateStore).assistantEntryInputRows[0];
  assert.equal(row.keyValue, "attempts");
  assert.equal(row.typeValue, "number");
  assert.equal(row.valueText, "3");
});

test("transaction vars preserve JSON property order and report invalid input", () => {
  const config = requiredTxVarsAssistantConfigByPrefix("tx-block-direct");
  setTxVarsRawText(
    TX_VARS.txBlockDirect,
    '{"first":"a","0":"zero","later":"b"}',
    { source: "editor" },
  );

  assert.deepEqual(
    get(txVarsAssistantStateFor(config)).assistantEntries.map(
      (entry) => entry.key,
    ),
    ["first", "0", "later"],
  );

  setTxVarsRawText(TX_VARS.txBlockDirect, '{"first":', {
    source: "editor",
  });

  const textState = get(txVarsTextStateFor(TX_VARS.txBlockDirect));
  assert.equal(textState.errorKind, "invalid");
  assert.match(textState.errorMessage, /JSON|position|end/i);
  assert.deepEqual(
    get(txVarsAssistantStateFor(config)).assistantEntries.map(
      (entry) => entry.key,
    ),
    ["first", "0", "later"],
  );
});

test("typed variable controls preserve nested values and boolean types", () => {
  const form = createTxVarsAssistantCardWorkspace({
    getPrefix: () => "tx-workflow-direct",
  });
  const targets = [{ address: "192.0.2.1", description: "two  spaces" }];
  setTxVarsRawText(
    TX_VARS.txWorkflowDirect,
    JSON.stringify({ enabled: true, targets, optional: null, retries: 3 }),
  );
  const rows = get(form.assistantDisplayStateStore).assistantEntryInputRows;
  const enabled = rows.find((row) => row.keyValue === "enabled")!;
  const list = rows.find((row) => row.keyValue === "targets")!;
  assert.equal(enabled.booleanValue, true);
  assert.deepEqual(JSON.parse(list.valuePreview), targets);
  assert.equal(list.showJsonEditor, true);

  const actions = get(form.assistantActionsStateStore);
  actions.updateEntryValue(enabled.entryId)("false");
  actions.updateEntryJsonValue(list.entryId)(
    JSON.stringify([...targets, { address: "192.0.2.2", tags: ["edge", 2] }]),
  );
  assert.deepEqual(
    JSON.parse(get(txVarsTextStateFor(TX_VARS.txWorkflowDirect)).raw),
    {
      enabled: false,
      targets: [...targets, { address: "192.0.2.2", tags: ["edge", 2] }],
      optional: null,
      retries: 3,
    },
  );
});

test("unfinished boolean input remains editable without discarding its text", () => {
  const form = createTxVarsAssistantCardWorkspace({
    getPrefix: () => "orchestration-direct",
  });
  setTxVarsRawText(TX_VARS.orchestrationDirect, '{"enabled":"pending"}');
  const actions = get(form.assistantActionsStateStore);
  const entry = get(form.assistantDisplayStateStore).assistantEntryInputRows[0];
  actions.updateEntryType(entry.entryId)({
    currentTarget: { value: "boolean" },
    target: { value: "boolean" },
  });
  const row = get(form.assistantDisplayStateStore).assistantEntryInputRows[0];
  assert.equal(row.booleanValue, null);
  assert.equal(row.valueText, "pending");
  assert.deepEqual(
    JSON.parse(get(txVarsTextStateFor(TX_VARS.orchestrationDirect)).raw),
    { enabled: "pending" },
  );
});

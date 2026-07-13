import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { get } from "svelte/store";

import {
  createTxVarsAssistantCardWorkspace,
  requiredTxVarsAssistantConfigByPrefix,
  setTxVarsRawText,
  TX_VARS,
  txVarsAssistantStateFor,
  txVarsTextStateFor,
} from "../src/modules/transactionVarsAssistant.js";
import { createTxDirectVarsPanelWorkspace } from "../src/modules/transactionInputState.js";

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

test("transaction vars text fields use direct value callbacks", () => {
  const source = readFileSync(
    "frontend/src/pages/orchestrated/OrchestrationVarsFormCard.svelte",
    "utf8",
  );

  assert.equal((source.match(/onValueInput=/g) || []).length, 2);
  assert.doesNotMatch(source, /onInput=\{assistantActions\.updateEntry/);
  assert.doesNotMatch(source, /assistantActions\.applyEntriesFromText/);
  assert.doesNotMatch(source, /assistantDisplay\.syncButtonLabel/);
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

test("transaction vars panels render their JSON errors", () => {
  const directSource = readFileSync(
    "frontend/src/pages/orchestrated/TxDirectVarsPanel.svelte",
    "utf8",
  );
  const templateSource = readFileSync(
    "frontend/src/pages/orchestrated/TxTemplateRunPanel.svelte",
    "utf8",
  );

  assert.match(directSource, /formError=\{panelDisplay\.formError\}/);
  assert.match(templateSource, /formError=\{panelDisplay\.varsFormError\}/);
});

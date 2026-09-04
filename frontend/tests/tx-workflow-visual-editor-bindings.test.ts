import assert from "node:assert/strict";
import test from "node:test";

import {
  txWorkflowDuplicateBlock,
  txWorkflowMoveBlock,
  txWorkflowTemplateRefEditorBindings,
  txWorkflowTemplateRefEditorDisplay,
  txWorkflowVisualEditorBindings,
  txWorkflowVisualEditorDisplay,
} from "../src/domains/transactions/index.js";
import type { JsonObject } from "../src/domains/transactions/index.js";

const valueEvent = (value: string) => ({ currentTarget: { value } });
const checkedEvent = (checked: boolean) => ({ currentTarget: { checked } });

test("tx workflow blocks duplicate and move without mutating the source", () => {
  const model = {
    blocks: [
      { sourceKind: "inline", inlineBlock: { name: "one" } },
      { sourceKind: "inline", inlineBlock: { name: "two" } },
    ],
  };

  const duplicated = txWorkflowDuplicateBlock(model, 0);
  const duplicatedBlocks = duplicated.blocks;
  assert.ok(duplicatedBlocks);
  assert.deepEqual(
    duplicatedBlocks.map((block) => block.inlineBlock.name),
    ["one", "one", "two"],
  );
  duplicatedBlocks[1].inlineBlock.name = "copy";
  assert.equal(duplicatedBlocks[0].inlineBlock.name, "one");

  const moved = txWorkflowMoveBlock(model, 1, 0);
  const movedBlocks = moved.blocks;
  assert.ok(movedBlocks);
  assert.deepEqual(
    movedBlocks.map((block) => block.inlineBlock.name),
    ["two", "one"],
  );
  assert.deepEqual(
    model.blocks.map((block) => block.inlineBlock.name),
    ["one", "two"],
  );
});

test("workflow editor omits empty structured metadata controls", () => {
  const model = {
    blocks: [
      {
        sourceKind: "inline",
        inlineBlock: { extra: {} },
        templateRef: { extra: {} },
      },
    ],
  };
  const display = txWorkflowVisualEditorDisplay(model);
  const bindings = txWorkflowVisualEditorBindings(model, () => {});
  const blockBindings = bindings.blockBindings(0);

  assert.equal(Object.hasOwn(display, "rootMetadataFieldRows"), false);
  assert.equal(Object.hasOwn(display, "rootMetadataSource"), false);
  assert.equal(Object.hasOwn(display.blockRows[0], "metadataFieldRows"), false);
  assert.equal(
    Object.hasOwn(display.blockRows[0], "metadataExtraSource"),
    false,
  );
  assert.equal(Object.hasOwn(bindings, "extraPresenceHandler"), false);
  assert.equal(Object.hasOwn(bindings, "extraValueHandler"), false);
  assert.equal(Object.hasOwn(bindings, "setRootExtra"), false);
  assert.equal(Object.hasOwn(blockBindings, "setMetadataPresence"), false);
  assert.equal(Object.hasOwn(blockBindings, "setMetadataValue"), false);
});

test("template ref editor bindings preserve source and presence patches", () => {
  const patches: JsonObject[] = [];
  const fieldPresenceChanges: Array<[string, boolean]> = [];
  const varsPresenceChanges: boolean[] = [];
  const bindings = txWorkflowTemplateRefEditorBindings(
    {
      hasTxBlockTemplateContent: false,
      hasTxBlockTemplateName: true,
      txBlockTemplateContent: null,
      txBlockTemplateName: "base",
    },
    {
      patchTemplateRef: (patch) => patches.push(patch),
      setTemplateRefFieldPresence: (field, enabled) =>
        fieldPresenceChanges.push([field, enabled]),
      setTemplateRefVarsPresence: (enabled) =>
        varsPresenceChanges.push(enabled),
    },
  );

  bindings.valueHandler("name")(valueEvent("custom"));
  bindings.sourceModeHandler()(valueEvent("content"));
  bindings.templateContentHandler()(valueEvent('{"name":"inline"}'));
  bindings.templateNameHandler()(valueEvent("saved"));
  bindings.setTemplateVars({ site: "edge" });
  bindings.setExtra({ owner: "network" });
  bindings.presenceToggle("name")(checkedEvent(false));
  bindings.varsToggle()(checkedEvent(true));

  assert.deepEqual(patches, [
    { hasName: true, name: "custom" },
    { hasTxBlockTemplateName: false, txBlockTemplateName: null },
    {
      hasTxBlockTemplateContent: true,
      hasTxBlockTemplateName: false,
      txBlockTemplateContent: '{"name":"inline"}',
      txBlockTemplateName: null,
    },
    {
      hasTxBlockTemplateContent: false,
      hasTxBlockTemplateName: true,
      txBlockTemplateContent: null,
      txBlockTemplateName: "saved",
    },
    { hasTxBlockTemplateVars: true, txBlockTemplateVars: { site: "edge" } },
    { extra: { owner: "network" } },
  ]);
  assert.deepEqual(fieldPresenceChanges, [["name", false]]);
  assert.deepEqual(varsPresenceChanges, [true]);
});

test("template ref editor bindings accept direct field values", () => {
  const patches: JsonObject[] = [];
  const fieldPresenceChanges: Array<[string, boolean]> = [];
  const bindings = txWorkflowTemplateRefEditorBindings(
    {},
    {
      patchTemplateRef: (patch) => patches.push(patch),
      setTemplateRefFieldPresence: (field, enabled) =>
        fieldPresenceChanges.push([field, enabled]),
    },
  );

  bindings.valueHandler("name")("edge block");
  bindings.sourceModeHandler()("content");
  bindings.presenceToggle("name")(true);

  assert.deepEqual(patches, [
    { hasName: true, name: "edge block" },
    { hasTxBlockTemplateName: false, txBlockTemplateName: null },
  ]);
  assert.deepEqual(fieldPresenceChanges, [["name", true]]);
});

test("template ref editor display preserves form-model variables", () => {
  const display = txWorkflowTemplateRefEditorDisplay({
    extra: {},
    failFast: true,
    hasFailFast: false,
    hasName: false,
    hasTxBlockTemplateContent: false,
    hasTxBlockTemplateName: true,
    hasTxBlockTemplateVars: true,
    name: null,
    txBlockTemplateContent: null,
    txBlockTemplateName: "base",
    txBlockTemplateVars: { site: "edge" },
  });

  assert.deepEqual(display.varsDisplay.source, { site: "edge" });
  assert.equal(display.varsDisplay.present, true);
});

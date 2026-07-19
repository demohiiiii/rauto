import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  commandFlowExecutionPayload,
  normalizeCommandFlowExecutionSource,
} from "../src/modules/standard/standardExecutionState.js";

function read(path) {
  return readFileSync(path, "utf8");
}

const commonPayload = {
  connection: { connection_name: "edge-01" },
  recordLevel: "summary",
  textfsm: {
    parse_textfsm: false,
    textfsm_platform: null,
    textfsm_strict_errors: false,
    textfsm_template: null,
  },
  vars: { destination: "/tmp/config" },
};

test("saved command flow execution sends template identity without inline content", () => {
  assert.deepEqual(
    commandFlowExecutionPayload({
      ...commonPayload,
      source: {
        kind: "saved",
        templateSelection: "deploy-config",
      },
    }),
    {
      template_name: "deploy-config",
      builtin_template_name: null,
      vars: { destination: "/tmp/config" },
      parse_textfsm: false,
      textfsm_platform: null,
      textfsm_strict_errors: false,
      textfsm_template: null,
      connection: { connection_name: "edge-01" },
      record_level: "summary",
    },
  );
});

test("temporary command flow execution sends inline content without template identity", () => {
  assert.deepEqual(
    commandFlowExecutionPayload({
      ...commonPayload,
      source: {
        content: 'name = "temporary"\nsteps = []\n',
        kind: "temporary",
      },
    }),
    {
      content: 'name = "temporary"\nsteps = []\n',
      vars: { destination: "/tmp/config" },
      parse_textfsm: false,
      textfsm_platform: null,
      textfsm_strict_errors: false,
      textfsm_template: null,
      connection: { connection_name: "edge-01" },
      record_level: "summary",
    },
  );
});

test("command flow execution source rejects incomplete saved and temporary drafts", () => {
  assert.throws(
    () => normalizeCommandFlowExecutionSource({ kind: "saved" }),
    /template/i,
  );
  assert.throws(
    () => normalizeCommandFlowExecutionSource({ kind: "temporary" }),
    /content/i,
  );
});

test("client exposes temporary inspection and save-as-template requests", () => {
  const client = read("frontend/src/api/client.js");

  assert.match(client, /export function inspectCommandFlowTemplate/);
  assert.match(client, /\/api\/flow-templates\/inspect/);
  assert.match(client, /export function createCommandFlowTemplate/);
  assert.match(client, /createTemplateResource\("\/api\/flow-templates"/);
});

test("client exposes explicit command flow template API helpers", () => {
  const client = read("frontend/src/api/client.js");

  assert.match(client, /export function getCommandFlowTemplate/);
  assert.match(client, /\/api\/flow-templates\/builtins/);
  assert.match(client, /export function updateCommandFlowTemplate/);
  assert.match(client, /updateTemplateResource\("\/api\/flow-templates"/);
});

test("standard flow workspace composes one unified authoring state", () => {
  const workspace = read(
    "frontend/src/modules/standard/standardExecutionWorkspaces.js",
  );

  assert.match(workspace, /createStandardCommandFlowAuthoringState/);
  assert.match(workspace, /authoring\.selectTemplate/);
  assert.match(workspace, /authoring\.executeSource/);
  assert.match(workspace, /authoring\.save/);
  assert.match(workspace, /authoring\.saveAs/);
  assert.match(workspace, /MODE_SELECT\.standardFlow/);
  assert.match(workspace, /saveButtonLabel: t\("flowTemplateSaveBtn"\)/);
  assert.doesNotMatch(workspace, /sourceModeStateStore/);
  assert.doesNotMatch(workspace, /changeFlowSourceMode/);
  assert.doesNotMatch(workspace, /saveTemporaryFlowTemplate/);
  assert.doesNotMatch(workspace, /savedSourceTabLabel/);
  assert.doesNotMatch(workspace, /temporarySourceTabLabel/);
  assert.doesNotMatch(workspace, /temporaryDraftDisplay/);
  assert.doesNotMatch(workspace, /setFlowVarsJsonOverridesText/);
  assert.doesNotMatch(workspace, /changeFlowJsonOverrides/);
});

test("standard command flow page renders one unified authoring workspace", () => {
  const panel = read("frontend/src/pages/standard/FlowExecutionPanel.svelte");
  const authoringViews = read(
    "frontend/src/components/command-flow/CommandFlowAuthoringViews.svelte",
  );
  const modes = read("frontend/src/config/dashboardModes.js");

  assert.match(panel, /CommandFlowAuthoringViews/);
  assert.match(authoringViews, /CommandFlowTemplateEditor/);
  assert.match(authoringViews, /CommandFlowReadonlyView/);
  assert.match(authoringViews, /TextAreaField/);
  assert.match(authoringViews, /import TabList/);
  assert.match(authoringViews, /commandFlowEditorViewTabs/);
  assert.doesNotMatch(
    panel,
    /import \* as Tabs from "\$lib\/components\/ui\/tabs/,
  );
  assert.match(
    panel,
    /import \* as Dialog from "\$lib\/components\/ui\/dialog/,
  );
  assert.match(panel, /Badge/);
  assert.match(panel, /includeEmptyOption=\{true\}/);
  assert.match(panel, /openNewFlowDialog/);
  assert.match(panel, /saveFlowTemplate/);
  assert.match(panel, /openSaveAsFlowDialog/);
  assert.match(authoringViews, /showNameField=\{false\}/);
  assert.doesNotMatch(panel, /value="saved"/);
  assert.doesNotMatch(panel, /value="temporary"/);
  assert.match(authoringViews, /activeValue=\{activeTab\}/);
  assert.match(authoringViews, /activeTab === "visual"/);
  assert.match(authoringViews, /activeTab === "readonly"/);
  assert.match(authoringViews, /tabItems=\{commandFlowEditorViewTabs\}/);
  assert.match(authoringViews, /addStepPlacement="footer"/);
  assert.match(authoringViews, /onValueInput=\{onTomlChange\}/);
  assert.match(modes, /value: "visual", labelKey: "flowVisualTab"/);
  assert.match(modes, /value: "toml", labelKey: "flowTomlTab"/);
  assert.match(
    modes,
    /value: "readonly", labelKey: "txBlockEditorReadonlyTab"/,
  );
  assert.match(panel, /<Dialog\.Title/);
  assert.match(panel, /data-command-flow-workbench/);
  assert.match(panel, /surfaceVariant="workbench-header"/);
  assert.match(panel, /surfaceVariant="workbench-section"/);
  assert.match(authoringViews, /settingsIndexText="01"/);
  assert.match(authoringViews, /stepsIndexText="02"/);
  assert.match(panel, /indexText="03"/);
  assert.match(panel, /indexText="04"/);
  assert.match(panel, /bg-muted\/30/);
  assert.match(panel, /flowStepCountLabel/);
  assert.match(panel, /flowVariableCountLabel/);
  assert.equal((panel.match(/variant="default"/g) || []).length, 1);
  assert.doesNotMatch(panel, /import \* as Card/);
  assert.doesNotMatch(panel, /<Card\./);
  assert.match(panel, /min-w-0/);
  assert.match(panel, /flex-wrap/);
  assert.doesNotMatch(panel, /saveTemporaryFlowTemplate/);
  assert.doesNotMatch(panel, /onJsonOverridesChange/);
});

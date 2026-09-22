import assert from "node:assert/strict";
import test from "node:test";

import {
  interactiveExecutionPayload,
  normalizeInteractiveExecutionSource,
} from "../src/domains/standard/index.js";
import type { StandardInteractiveExecutionInput } from "../src/domains/standard/index.js";

const commonPayload = {
  connection: { connection_name: "edge-01" },
  recordLevel: "key-events-only",
  textfsm: {
    parse_textfsm: false,
    textfsm_strict_errors: false,
    textfsm_template: null,
  },
  vars: { destination: "/tmp/config" },
} satisfies StandardInteractiveExecutionInput;

test("saved interactive command execution sends template identity without inline content", () => {
  assert.deepEqual(
    interactiveExecutionPayload({
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
      textfsm_strict_errors: false,
      textfsm_template: null,
      connection: { connection_name: "edge-01" },
      record_level: "key-events-only",
    },
  );
});

test("temporary interactive command execution sends inline content without template identity", () => {
  assert.deepEqual(
    interactiveExecutionPayload({
      ...commonPayload,
      source: {
        content: 'name = "temporary"\ncommand = ""\n',
        kind: "temporary",
      },
    }),
    {
      content: 'name = "temporary"\ncommand = ""\n',
      vars: { destination: "/tmp/config" },
      parse_textfsm: false,
      textfsm_strict_errors: false,
      textfsm_template: null,
      connection: { connection_name: "edge-01" },
      record_level: "key-events-only",
    },
  );
});

test("interactive command execution source rejects incomplete saved and temporary drafts", () => {
  assert.throws(
    () => normalizeInteractiveExecutionSource({ kind: "saved" }),
    /template/i,
  );
  assert.throws(
    () => normalizeInteractiveExecutionSource({ kind: "temporary" }),
    /content/i,
  );
});

test("interactive auto download preserves settings captured before template loading", async (t) => {
  const {
    executeInteractive,
    setStandardTextfsmFields,
    interactiveExecutionResultState,
    createInteractiveExecutionPanelWorkspace,
  } = await import("../src/domains/standard/index.js");
  const { get } = await import("svelte/store");
  const { standardInteractiveApi } =
    await import("../src/domains/standard/infrastructure/standardInteractiveApi.js");
  const { standardInteractiveRuntime } =
    await import("../src/domains/standard/infrastructure/standardInteractiveRuntime.js");
  const { executionResultApi } =
    await import("../src/domains/execution/infrastructure/executionResultApi.js");
  const { executionResultRuntime } =
    await import("../src/domains/execution/infrastructure/executionResultRuntime.js");
  t.after(() => {
    setStandardTextfsmFields();
    interactiveExecutionResultState().set({ kind: "empty" });
  });
  t.mock.method(standardInteractiveRuntime, "ensureTarget", () => true);
  t.mock.method(standardInteractiveRuntime, "connectionPayload", () => ({}));
  t.mock.method(standardInteractiveRuntime, "buildVarsPayload", () => null);
  t.mock.method(
    standardInteractiveRuntime,
    "ensureTemplateDetail",
    async () => {
      setStandardTextfsmFields({ enabled: false, autoDownloadExcel: false });
      return null;
    },
  );
  const interactive = t.mock.method(
    standardInteractiveApi,
    "executeInteractive",
    async () => ({
      outputs: [
        {
          all: "version 1",
          command: "show version",
          error: null,
          exit_code: 0,
          output: "version 1",
          parse_error: null,
          parsed_output: [{ version: "1" }],
          success: true,
        },
      ],
      recording_jsonl: null,
      result_summary: {
        operation: "interactive",
        outcome: "success",
        success: true,
        summary: "Completed",
      },
      success: true,
      template_name: "inventory",
    }),
  );
  const exported = t.mock.method(
    executionResultApi,
    "exportExcel",
    async () => ({ blob: new Blob(["excel"]) }),
  );
  const downloads = t.mock.method(executionResultRuntime, "download", () => {});
  const workspace = createInteractiveExecutionPanelWorkspace();
  workspace.changeInteractiveAutoDownloadExcel(true);
  assert.equal(
    get(workspace.interactivePanelDisplayStateStore).interactiveTextfsmFields
      .autoDownloadExcel,
    true,
  );
  setStandardTextfsmFields({ enabled: true, autoDownloadExcel: true });
  await executeInteractive({ kind: "saved", templateSelection: "inventory" });
  const flowPayload = interactive.mock.calls[0].arguments[0];
  assert.ok(flowPayload);
  assert.equal(flowPayload.parse_textfsm, true);
  assert.equal(Object.hasOwn(flowPayload, "autoDownloadExcel"), false);
  assert.equal(exported.mock.callCount(), 1);
  assert.equal(downloads.mock.callCount(), 1);
  const exportPayload = exported.mock.calls[0].arguments[0];
  assert.ok(exportPayload);
  assert.match(
    exportPayload.filename ?? "",
    /^textfsm-interactive-\d{8}-\d{6}\.xlsx$/,
  );
  assert.equal(get(interactiveExecutionResultState()).kind, "result");
});

test("interactive text output downloads without TextFSM and preserves original connection after execution", async (t) => {
  const {
    executeInteractive,
    setStandardTextfsmFields,
    interactiveExecutionResultState,
  } = await import("../src/domains/standard/index.js");
  const { downloadInteractiveOutput } =
    await import("../src/domains/standard/application/standardInteractiveExecutionState.js");
  const { standardInteractiveApi } =
    await import("../src/domains/standard/infrastructure/standardInteractiveApi.js");
  const { standardInteractiveRuntime } =
    await import("../src/domains/standard/infrastructure/standardInteractiveRuntime.js");
  const { executionResultRuntime } =
    await import("../src/domains/execution/infrastructure/executionResultRuntime.js");
  t.after(() => {
    setStandardTextfsmFields();
    interactiveExecutionResultState().set({ kind: "empty" });
  });
  t.mock.method(standardInteractiveRuntime, "ensureTarget", () => true);
  t.mock.method(standardInteractiveRuntime, "connectionPayload", () => ({
    connection_name: "edge-original",
  }));
  t.mock.method(standardInteractiveRuntime, "buildVarsPayload", () => null);
  t.mock.method(
    standardInteractiveApi,
    "executeInteractive",
    async (
      payload: Parameters<typeof standardInteractiveApi.executeInteractive>[0],
    ) => {
      assert.equal(payload.parse_textfsm, false);
      setStandardTextfsmFields({ autoDownloadOutput: false });
      return {
        outputs: [
          {
            command: "uptime",
            output: "running",
            all: null,
            error: null,
            exit_code: 0,
            parsed_output: null,
            parse_error: null,
            success: true,
          },
        ],
        recording_jsonl: null,
        result_summary: {
          operation: "interactive",
          outcome: "success",
          success: true,
          summary: "Completed",
        },
        success: true,
        template_name: "temporary",
      };
    },
  );
  const download = t.mock.method(executionResultRuntime, "download", () => {});
  setStandardTextfsmFields({ enabled: false, autoDownloadOutput: true });
  await executeInteractive({ kind: "temporary", content: 'name = "test"' });
  t.mock.method(standardInteractiveRuntime, "connectionPayload", () => ({
    connection_name: "other-device",
  }));
  await downloadInteractiveOutput();
  assert.equal(download.mock.callCount(), 2);
  const blob = download.mock.calls[1].arguments[0];
  assert.ok(blob);
  assert.equal(await blob.text(), "=== edge-original ===\n$ uptime\nrunning");
});

for (const scope of ["single", "batch"] as const) {
  test(`returning to ${scope} interactive delivery refreshes the catalog while preserving the selected draft and variables`, async (t) => {
    const { get } = await import("svelte/store");
    const { createInteractiveExecutionPanelWorkspace } =
      await import("../src/domains/standard/index.js");
    const { createBatchDeliveryWorkspace } =
      await import("../src/domains/standard/application/createBatchDeliveryWorkspace.js");
    const { templatesApi } =
      await import("../src/domains/templates/infrastructure/templatesApi.js");
    let names = ["existing", "removed"];
    let fail = false;
    const loadTemplates = t.mock.method(
      templatesApi,
      "listTemplateResource",
      async (path: string) => {
        if (fail) throw new Error("temporarily unavailable");
        return (path.endsWith("/builtins") ? ["builtin-copy"] : names).map(
          (name) => ({
            name,
            kind: "interactive",
            source: "custom",
            content_type: "application/toml",
            size_bytes: 0,
            created_at_ms: 0,
            updated_at_ms: 0,
          }),
        );
      },
    );
    const detail = {
      name: "existing",
      content: 'name = "existing"\ncommand = "show {{item}}"',
      vars_schema: [
        {
          name: "item",
          label: "item",
          type: "string",
          required: true,
          allow_empty: false,
          default: null,
          description: null,
          placeholder: null,
          options: [],
        },
      ],
    };
    const fetchDetail = t.mock.method(globalThis, "fetch", async () =>
      Response.json(detail),
    );
    const workspace = createInteractiveExecutionPanelWorkspace(
      scope === "batch"
        ? createBatchDeliveryWorkspace("interactive")
        : undefined,
    );
    const display = () => get(workspace.interactivePanelDisplayStateStore);
    const activate = () =>
      workspace.setPanelContext({
        active: true,
        interactivePanelDisplay: display(),
      });
    const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
    activate();
    await settle();
    assert.equal(loadTemplates.mock.callCount(), 2);
    assert.deepEqual(display().interactiveTemplateFields.templateOptions, [
      ...names,
      "builtin:builtin-copy",
    ]);
    assert.equal(
      await workspace.changeInteractiveTemplateName("existing"),
      true,
    );
    const draft = 'name = "existing"\ncommand = "show {{item}} detail"\n';
    workspace.changeInteractiveToml(draft);
    await workspace.authoring.inspectCurrent();
    workspace.changeInteractiveVarValue("item")({
      currentTarget: { value: "version" },
    });
    workspace.changeInteractiveAutoDownloadOutput(true);
    const before = display();
    const fetchCount = fetchDetail.mock.callCount();
    activate();
    assert.equal(
      loadTemplates.mock.callCount(),
      2,
      "active form updates must not reload the catalog",
    );
    workspace.setPanelContext({ active: false });
    names = ["existing", "newly-created"];
    activate();
    await settle();
    assert.equal(loadTemplates.mock.callCount(), 4);
    assert.deepEqual(display().interactiveTemplateFields.templateOptions, [
      ...names,
      "builtin:builtin-copy",
    ]);
    assert.equal(get(workspace.authoring.draft.tomlTextStateStore), draft);
    assert.equal(display().authoringDisplay.dirty, true);
    assert.deepEqual(
      display().authoringDisplay.selection,
      before.authoringDisplay.selection,
    );
    assert.deepEqual(
      display().interactiveVarsDisplay.fieldRows,
      before.interactiveVarsDisplay.fieldRows,
    );
    assert.equal(
      display().interactiveVarsDisplay.fieldRows[0].value,
      "version",
    );
    assert.equal(display().interactiveTextfsmFields.autoDownloadOutput, true);
    assert.equal(
      fetchDetail.mock.callCount(),
      fetchCount,
      "refresh must not reload selected template content",
    );
    workspace.setPanelContext({ active: false });
    fail = true;
    activate();
    await settle();
    assert.equal(get(workspace.authoring.draft.tomlTextStateStore), draft);
    workspace.setPanelContext({ active: false });
    fail = false;
    activate();
    await settle();
    assert.equal(
      loadTemplates.mock.callCount(),
      8,
      "later activation retries failed catalog requests",
    );
    assert.deepEqual(display().interactiveTemplateFields.templateOptions, [
      ...names,
      "builtin:builtin-copy",
    ]);
  });
}

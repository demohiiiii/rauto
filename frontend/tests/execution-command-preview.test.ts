import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { get } from "svelte/store";
import { loadI18nLanguage } from "../src/lib/i18n.js";
import { createExecutionCommandPreviewWorkspace } from "../src/domains/orchestration/application/executionCommandPreviewWorkspace.js";
import type {
  ExecutionCommandPreviewInput,
  ExecutionCommandPreviewPort,
} from "../src/domains/orchestration/application/executionCommandPreviewWorkspace.js";
import type { TxWorkflowExecutionResponse } from "../src/domains/orchestration/model/orchestratedExecutionPayloads.js";
import type { RenderedWorkflow } from "../src/domains/transactions/model/renderedWorkflow.js";

const workflow: RenderedWorkflow = {
  name: "rendered",
  fail_fast: true,
  blocks: [
    {
      name: "192.0.2.1",
      fail_fast: true,
      rollback_policy: "per_step",
      steps: [
        {
          run: {
            kind: "command",
            mode: "Root,User",
            command: "echo 192.0.2.1\necho second",
            multiline_mode: "whole",
            timeout: null,
            dyn_params: {},
            interaction: {
              prompts: [
                { patterns: ["Confirm"], response: "y\n", record_input: false },
              ],
            },
          },
          rollback: {
            kind: "command",
            mode: "Root,User",
            command: "undo 192.0.2.1",
            multiline_mode: "split_lines",
            timeout: null,
            dyn_params: {},
            interaction: { prompts: [] },
          },
          rollback_on_failure: true,
        },
      ],
    },
  ],
};
const response = (): TxWorkflowExecutionResponse => ({
  workflow,
  recording_jsonl: null,
  tx_workflow_result: null,
  result_summary: {},
});
const input: ExecutionCommandPreviewInput = {
  feature: "tx-workflow",
  sourceText: '{"name":"source","blocks":[]}',
  varsText: '{"addresses":["192.0.2.1"]}',
  connection: { connection_name: "device-a" },
};
const port = (
  overrides: Partial<ExecutionCommandPreviewPort> = {},
): ExecutionCommandPreviewPort => ({
  executeTxWorkflow: async () => response(),
  executeOrchestration: async () => {
    throw new Error("unexpected orchestration");
  },
  ...overrides,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

test("workflow preview sends current source, target and vars as a dry run", async () => {
  const workspace = createExecutionCommandPreviewWorkspace(
    port({
      executeTxWorkflow: async (request, signal) => {
        assert.equal(request.dry_run, true);
        assert.equal(request.preview_commands, true);
        assert.deepEqual(request.workflow_vars, { addresses: ["192.0.2.1"] });
        assert.deepEqual(request.connection, { connection_name: "device-a" });
        assert.equal(request.workflow.name, "source");
        assert.equal(signal.aborted, false);
        return response();
      },
    }),
  );
  await workspace.show(input);
  assert.equal(get(workspace.state).loading, false);
  assert.deepEqual(get(workspace.state).entries[0].workflow, workflow);
  assert.equal(get(workspace.state).entries[0].connectionName, "device-a");
  workspace.destroy();
});

test("orchestration requests per-target rendering and preserves device workflows", async () => {
  const workspace = createExecutionCommandPreviewWorkspace(
    port({
      executeOrchestration: async (request) => {
        assert.equal(request.dry_run, true);
        assert.equal(request.preview_commands, true);
        assert.deepEqual(request.plan_vars, { addresses: ["192.0.2.1"] });
        return {
          plan: {
            name: "plan",
            fail_fast: true,
            rollback_on_stage_failure: false,
            rollback_completed_stages_on_failure: false,
            stages: [],
          },
          orchestration_result: null,
          result_summary: {},
          rendered_workflows: ["a", "b"].map((target, index) => ({
            stage_index: 0,
            stage_name: "deploy",
            job_index: index,
            job_name: "addresses",
            connection_name: target,
            host: `192.0.2.${index + 1}`,
            workflow: { ...workflow, name: target },
          })),
        };
      },
    }),
  );
  await workspace.show({ ...input, feature: "orchestrate" });
  assert.deepEqual(
    get(workspace.state).entries.map((entry) => [
      entry.stageName,
      entry.jobName,
      entry.connectionName,
      entry.workflow.name,
    ]),
    [
      ["deploy", "addresses", "a", "a"],
      ["deploy", "addresses", "b", "b"],
    ],
  );
  workspace.destroy();
});

test("newer preview wins even if an aborted request resolves last", async () => {
  const pending = [
    deferred<TxWorkflowExecutionResponse>(),
    deferred<TxWorkflowExecutionResponse>(),
  ];
  const signals: AbortSignal[] = [];
  const workspace = createExecutionCommandPreviewWorkspace(
    port({
      executeTxWorkflow: (_, signal) => {
        signals.push(signal);
        return pending[signals.length - 1].promise;
      },
    }),
  );
  const first = workspace.show(input);
  const second = workspace.show({
    ...input,
    connection: { connection_name: "device-b" },
  });
  assert.equal(signals[0].aborted, true);
  pending[1].resolve(response());
  await second;
  pending[0].resolve({
    ...response(),
    workflow: { ...workflow, name: "stale" },
  });
  await first;
  assert.equal(get(workspace.state).entries[0].workflow.name, "rendered");
  assert.equal(get(workspace.state).entries[0].connectionName, "device-b");
  workspace.destroy();
});

test("changed input and close suppress late responses and errors", async () => {
  const pending = deferred<TxWorkflowExecutionResponse>();
  let signal: AbortSignal | undefined;
  const workspace = createExecutionCommandPreviewWorkspace(
    port({
      executeTxWorkflow: (_, nextSignal) => {
        signal = nextSignal;
        return pending.promise;
      },
    }),
  );
  const request = workspace.show(input);
  workspace.updateInput({ ...input, varsText: "{}" });
  assert.equal(signal?.aborted, true);
  assert.equal(get(workspace.state).stale, true);
  assert.deepEqual(get(workspace.state).entries, []);
  workspace.close();
  pending.reject(new Error("obsolete failure"));
  await request;
  assert.equal(get(workspace.state).open, false);
  assert.equal(get(workspace.state).error, "");
  workspace.destroy();
});

test("invalid source, variables and missing workflow target do not call execution APIs", async () => {
  await loadI18nLanguage("zh");
  let calls = 0;
  const workspace = createExecutionCommandPreviewWorkspace(
    port({
      executeTxWorkflow: async () => {
        calls += 1;
        return response();
      },
    }),
  );
  for (const value of [
    { ...input, varsText: "[]" },
    { ...input, varsText: "{" },
    { ...input, sourceText: "[]" },
    { ...input, connection: undefined },
  ]) {
    await workspace.show(value);
    assert.ok(get(workspace.state).error);
    assert.equal(get(workspace.state).loading, false);
  }
  assert.equal(calls, 0);
  workspace.destroy();
});

test("both execution bars share complete rollback and multiline preview wiring", () => {
  for (const file of [
    "domains/transactions/presentation/components/workflow/TxWorkflowStage.svelte",
    "domains/orchestration/presentation/components/editor/OrchestrationEditorSurface.svelte",
  ]) {
    const source = readFileSync(
      new URL(`../src/${file}`, import.meta.url),
      "utf8",
    );
    assert.match(source, /snippet actions\(\)[\s\S]*?<ExecutionCommandPreview/);
  }
  const view = readFileSync(
    new URL(
      "../src/domains/transactions/presentation/components/workflow/RenderedWorkflowCommands.svelte",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(view, /operation=\{step\.rollback\}/);
  assert.match(view, /whole_resource\.rollback/);
  const command = readFileSync(
    new URL(
      "../src/domains/transactions/presentation/components/workflow/RenderedOperationCard.svelte",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(command, /<pre[^>]*whitespace-pre[^>]*data-rendered-command/);
  assert.match(command, /command\.interaction\.prompts/);
  assert.match(command, /command\.dyn_params/);
});

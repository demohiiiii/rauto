import assert from "node:assert/strict";
import test from "node:test";

import {
  orchestrationInlineWorkflowPreview,
  createOrchestrationWorkflowPreviewWorkspace,
} from "../src/domains/orchestration/index.js";
import type { JsonObject } from "../src/domains/orchestration/index.js";
import {
  txWorkflowFlowGraph,
  txWorkflowFormModelFromJson,
} from "../src/domains/transactions/index.js";

test("inline workflow preview snapshots the complete workflow", () => {
  const source = {
    name: "campus-upgrade",
    blocks: [
      {
        name: "backup",
        steps: [
          {
            run: { kind: "command", command: "show running-config" },
          },
        ],
      },
    ],
  };
  const preview = orchestrationInlineWorkflowPreview(source);

  assert.equal(preview.sourceKind, "manual");
  assert.equal(preview.workflowName, "campus-upgrade");
  assert.deepEqual(preview.workflow, source);
  source.blocks[0].steps[0].run.command = "changed";
  assert.notDeepEqual(preview.workflow, source);
});

test("workflow previews retain loop, choice, interactive and rollback content", () => {
  const workflow = {
    blocks: [
      {
        kind: "loop",
        iterations: "vars.ports",
        blocks: [
          {
            kind: "choice",
            branches: [
              {
                condition: "vars.enabled",
                blocks: [
                  {
                    name: "inspect",
                    steps: [
                      {
                        run: {
                          kind: "command",
                          command: "delete file",
                          interaction: {
                            prompts: [{ patterns: ["Confirm"], response: "y" }],
                          },
                        },
                        rollback: {
                          kind: "command",
                          command: "restore\nverify",
                        },
                      },
                    ],
                  },
                ],
              },
            ],
            else: [],
          },
        ],
      },
    ],
  };
  const preview = orchestrationInlineWorkflowPreview(workflow);
  assert.deepEqual(preview.workflow, workflow);
});

test("workflow preview preserves every block for nested canvas nodes", () => {
  const blocks = Array.from({ length: 6 }, (_, index) => ({
    name: `block-${index + 1}`,
    steps: [{ run: { kind: "command", command: `show item ${index + 1}` } }],
  }));
  const preview = orchestrationInlineWorkflowPreview({ blocks });
  assert.equal(preview.blockCount, 6);
  assert.deepEqual(preview.workflow.blocks, blocks);
});

test("template preview workspace caches by template name and vars", async () => {
  const requests: Array<{ name: string; vars: JsonObject }> = [];
  const workspace = createOrchestrationWorkflowPreviewWorkspace({
    previewTemplate: async (name, vars) => {
      requests.push({ name, vars });
      return {
        workflow: {
          name: "rendered",
          blocks: [
            {
              name: "deploy",
              steps: [
                {
                  run: {
                    kind: "command",
                    command: `set version ${vars.version}`,
                  },
                },
              ],
            },
          ],
        },
        unresolved_paths: ["$.blocks[0].steps[0].run.command"],
      };
    },
  });

  const first = await workspace.previewTemplate("campus-upgrade", {
    version: "17.9",
  });
  const second = await workspace.previewTemplate("campus-upgrade", {
    version: "17.9",
  });
  const third = await workspace.previewTemplate("campus-upgrade", {
    version: "18.1",
  });

  assert.equal(first.sourceKind, "template");
  assert.equal(first.unresolvedCount, 1);
  assert.equal(first.workflow.name, "rendered");
  assert.deepEqual(
    [first, second, third].map(
      (preview) =>
        txWorkflowFlowGraph(txWorkflowFormModelFromJson(preview.workflow))
          .blocks[0].data.commandRows[0].summaryText,
    ),
    ["set version 17.9", "set version 17.9", "set version 18.1"],
  );
  assert.equal(requests.length, 2);
});

test("template preview rejects a non-object workflow response", async () => {
  const workspace = createOrchestrationWorkflowPreviewWorkspace({
    previewTemplate: async () => ({
      workflow: [],
      unresolved_paths: [],
    }),
  });

  const preview = await workspace.previewTemplate("invalid-workflow");

  assert.equal(preview.previewStatus, "error");
  assert.match(
    preview.errorMessage,
    /template workflow preview must be a JSON object/,
  );
  assert.deepEqual(preview.workflow, {});
});

test("template preview cache ignores variable property order", async () => {
  let requestCount = 0;
  const workspace = createOrchestrationWorkflowPreviewWorkspace({
    previewTemplate: async () => {
      requestCount += 1;
      return { workflow: { blocks: [] }, unresolved_paths: [] };
    },
  });

  await workspace.previewTemplate("campus-upgrade", {
    site: "north",
    version: "17.9",
  });
  await workspace.previewTemplate("campus-upgrade", {
    version: "17.9",
    site: "north",
  });

  assert.equal(requestCount, 1);
});

test("template preview snapshots the response payload", async () => {
  const response = {
    workflow: { name: "rendered", blocks: [] },
    unresolved_paths: ["$.blocks[0]"],
  };
  const workspace = createOrchestrationWorkflowPreviewWorkspace({
    previewTemplate: async () => response,
  });

  const preview = await workspace.previewTemplate("campus-upgrade");
  response.workflow.name = "changed";
  response.unresolved_paths.push("$.blocks[1]");

  assert.equal(preview.workflow.name, "rendered");
  assert.deepEqual(preview.unresolvedPaths, ["$.blocks[0]"]);
});

test("unresolved enum fields produce a recoverable preview state without altering template content", async () => {
  const workspace = createOrchestrationWorkflowPreviewWorkspace({
    previewTemplate: async (_, vars) => ({
      workflow: {
        name: "templated",
        blocks: [
          {
            name: "configure",
            steps: [
              {
                run: {
                  kind: "command",
                  command: "echo test",
                  multiline_mode:
                    typeof vars.mode === "string"
                      ? vars.mode
                      : "{{ vars.mode }}",
                },
              },
            ],
          },
        ],
      },
      unresolved_paths: vars.mode
        ? []
        : ["$.blocks[0].steps[0].run.multiline_mode"],
    }),
  });
  const unresolved = await workspace.previewTemplate("templated");
  assert.equal(unresolved.previewStatus, "error");
  assert.match(unresolved.errorMessage, /multiline_mode/);
  assert.equal(unresolved.unresolvedCount, 1);
  assert.ok(JSON.stringify(unresolved.workflow).includes("{{ vars.mode }}"));
  const resolved = await workspace.previewTemplate("templated", {
    mode: "whole",
  });
  assert.equal(resolved.previewStatus, "ready");
  assert.equal(resolved.errorMessage, "");
  assert.equal(resolved.unresolvedCount, 0);
});

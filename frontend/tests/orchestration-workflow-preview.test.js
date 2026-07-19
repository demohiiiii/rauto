import assert from "node:assert/strict";
import test from "node:test";

import {
  orchestrationInlineWorkflowPreview,
  createOrchestrationWorkflowPreviewWorkspace,
} from "../src/modules/orchestration/orchestrationWorkflowPreviewState.js";

test("inline workflow preview exposes compact ordered block rows", () => {
  const preview = orchestrationInlineWorkflowPreview({
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
  });

  assert.equal(preview.sourceKind, "manual");
  assert.equal(preview.workflowName, "campus-upgrade");
  assert.deepEqual(preview.rows, [
    {
      blockName: "backup",
      operationText: "show running-config",
      operationTexts: ["show running-config"],
    },
  ]);
  assert.deepEqual(preview.allRows, preview.rows);
  assert.equal(preview.workflow.name, "campus-upgrade");
  assert.equal(preview.workflow.blocks[0].name, "backup");
});

test("workflow preview flattens every transaction and command-flow command", () => {
  const preview = orchestrationInlineWorkflowPreview({
    blocks: [
      {
        name: "inspect",
        steps: [
          { run: { kind: "command", command: "show version" } },
          {
            run: {
              kind: "flow",
              steps: [
                { command: "show inventory" },
                { command: "show interfaces" },
              ],
            },
          },
        ],
      },
    ],
  });

  assert.deepEqual(preview.allRows[0].operationTexts, [
    "show version",
    "show inventory",
    "show interfaces",
  ]);
});

test("workflow preview preserves every block for nested canvas nodes", () => {
  const preview = orchestrationInlineWorkflowPreview({
    blocks: Array.from({ length: 6 }, (_, index) => ({
      name: `block-${index + 1}`,
      steps: [{ run: { kind: "command", command: `show item ${index + 1}` } }],
    })),
  });

  assert.equal(preview.rows.length, 4);
  assert.equal(preview.allRows.length, 6);
  assert.equal(preview.overflowCount, 2);
});

test("template preview workspace caches by template name and vars", async () => {
  const requests = [];
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
  assert.equal(first.workflow.blocks[0].name, "deploy");
  assert.deepEqual(first.rows[0].operationText, "set version 17.9");
  assert.equal(second.rows[0].operationText, "set version 17.9");
  assert.equal(third.rows[0].operationText, "set version 18.1");
  assert.equal(requests.length, 2);
});

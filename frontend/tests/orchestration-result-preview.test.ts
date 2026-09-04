import assert from "node:assert/strict";
import test from "node:test";

import {
  orchestrationJsonDisplay,
  orchestrationPreviewPresentation,
} from "../src/domains/orchestration/index.js";

test("orchestration JSON display builds nested tree and raw projections", () => {
  const display = orchestrationJsonDisplay({
    stages: [{ name: "prepare" }],
  });

  assert.match(display.rawText, /"prepare"/);
  assert.equal(display.tree.kind, "object");
  const stagesNode = display.tree.children?.[0];
  assert.ok(stagesNode);
  assert.equal(stagesNode.label, "stages");
  assert.equal(stagesNode.kind, "array");
  const stageNode = stagesNode.children?.[0];
  assert.ok(stageNode);
  const nameNode = stageNode.children?.[0];
  assert.ok(nameNode);
  assert.equal(nameNode.valueText, "prepare");
});

test("orchestration preview presents targets and workflow commands", () => {
  const preview = orchestrationPreviewPresentation({
    fail_fast: false,
    name: "rollout",
    rollback_completed_stages_on_failure: false,
    rollback_on_stage_failure: false,
    stages: [
      {
        fail_fast: null,
        max_parallel: null,
        name: "prepare",
        strategy: "parallel",
        jobs: [
          {
            fail_fast: null,
            max_parallel: null,
            name: "collect",
            strategy: "parallel",
            target_groups: ["core"],
            target_tags: ["edge"],
            targets: ["switch-1", "switch-2"],
            action: {
              kind: "tx_workflow",
              workflow_template_name: null,
              workflow_vars: {},
              workflow: {
                blocks: [
                  {
                    steps: [
                      { run: { kind: "command", command: "show version" } },
                      {
                        run: {
                          kind: "flow",
                          steps: [
                            { command: "show clock" },
                            { command: "show inventory" },
                          ],
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
        ],
      },
    ],
  });

  const stage = preview.stageRows[0];
  const job = stage.jobs[0];
  assert.equal(preview.jobCount, 1);
  assert.equal(stage.targetCount, 4);
  assert.deepEqual(job.targetChipRows.map((row) => row.chipText).slice(-2), [
    "switch-1",
    "switch-2",
  ]);
  assert.deepEqual(job.commandPreview.lines, [
    "block[0] step[0] show version",
    "block[0] step[1] show clock ... (2 steps)",
  ]);
});

test("orchestration command preview limits long workflows", () => {
  const preview = orchestrationPreviewPresentation({
    fail_fast: false,
    name: "",
    rollback_completed_stages_on_failure: false,
    rollback_on_stage_failure: false,
    stages: [
      {
        fail_fast: null,
        max_parallel: null,
        name: "",
        strategy: "serial",
        jobs: [
          {
            fail_fast: null,
            max_parallel: null,
            name: null,
            strategy: "serial",
            target_groups: [],
            target_tags: [],
            targets: [],
            action: {
              kind: "tx_workflow",
              workflow_template_name: null,
              workflow_vars: {},
              workflow: {
                blocks: [
                  {
                    steps: Array.from({ length: 25 }, (_, index) => ({
                      run: { kind: "command", command: `show ${index}` },
                    })),
                  },
                ],
              },
            },
          },
        ],
      },
    ],
  });
  const commandPreview = preview.stageRows[0].jobs[0].commandPreview;

  assert.equal(commandPreview.lines.length, 24);
  assert.equal(commandPreview.overflowCount, 1);
  assert.equal(commandPreview.showOverflow, true);
});

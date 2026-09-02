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
  assert.equal(display.tree.children[0].label, "stages");
  assert.equal(display.tree.children[0].kind, "array");
  assert.equal(
    display.tree.children[0].children[0].children[0].valueText,
    "prepare",
  );
});

test("orchestration preview presents targets and workflow commands", () => {
  const preview = orchestrationPreviewPresentation({
    name: "rollout",
    stages: [
      {
        name: "prepare",
        strategy: "parallel",
        jobs: [
          {
            name: "collect",
            target_groups: ["core"],
            target_tags: ["edge"],
            targets: ["switch-1", "switch-2"],
            action: {
              kind: "tx_workflow",
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
    stages: [
      {
        jobs: [
          {
            action: {
              kind: "tx_workflow",
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

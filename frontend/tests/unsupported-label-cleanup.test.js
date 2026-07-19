import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  txBlockFormModelFromJson,
  txBlockFormModelToJsonText,
} from "../src/modules/transactions/transactionBlockFormModels.js";
import {
  txWorkflowFormModelFromJson,
  txWorkflowFormModelToJsonText,
} from "../src/modules/transactions/transactionWorkflowFormModels.js";
import {
  orchestrationPlanFormModelFromJson,
  orchestrationPlanFormModelToJsonText,
} from "../src/modules/orchestration/orchestrationPlanFormModels.js";

function source(path) {
  return readFileSync(path, "utf8");
}

function collectUnsupportedLabels(value, path = "") {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      collectUnsupportedLabels(entry, `${path}[${index}]`),
    );
  }
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, entry]) => [
    ...(key.endsWith("_label") ? [`${path}.${key}`] : []),
    ...collectUnsupportedLabels(entry, path ? `${path}.${key}` : key),
  ]);
}

test("transaction models remove every unsupported underscore label", () => {
  const block = {
    name: "labels",
    rollback_policy: "none",
    fail_fast: true,
    root_label: "root",
    steps: [
      {
        step_label: "step",
        run: {
          kind: "flow",
          flow_label: "flow",
          steps: [
            {
              mode: "Enable",
              command: "show version",
              flow_step_label: "flow-step",
              command_extension: "drop-command-extra",
              interaction: {
                prompts: [
                  {
                    patterns: ["confirm"],
                    response: "yes",
                    prompt_label: "prompt",
                  },
                ],
              },
            },
          ],
        },
        rollback: null,
      },
    ],
  };
  const json = JSON.parse(
    txBlockFormModelToJsonText(txBlockFormModelFromJson(block)),
  );

  assert.deepEqual(collectUnsupportedLabels(json), []);
  assert.equal(
    Object.hasOwn(json.steps[0].run.steps[0], "command_extension"),
    false,
  );
});

test("workflow and orchestration models remove unsupported labels", () => {
  const workflowJson = JSON.parse(
    txWorkflowFormModelToJsonText(
      txWorkflowFormModelFromJson({
        name: "workflow",
        workflow_label: "workflow-label",
        blocks: [
          {
            name: "block",
            inline_block_label: "block-label",
            rollback_policy: "none",
            steps: [],
          },
        ],
      }),
    ),
  );
  assert.deepEqual(collectUnsupportedLabels(workflowJson), []);

  const orchestrationJson = JSON.parse(
    orchestrationPlanFormModelToJsonText(
      orchestrationPlanFormModelFromJson({
        name: "plan",
        plan_label: "plan-label",
        inventory: {
          defaults: { defaults_label: "defaults-label" },
          groups: {
            edge: {
              group_label: "group-label",
              targets: [{ host: "192.0.2.1", target_label: "target-label" }],
            },
          },
        },
        stages: [
          {
            name: "stage",
            stage_label: "stage-label",
            strategy: "serial",
            jobs: [
              {
                job_label: "job-label",
                strategy: "serial",
                targets: [],
                action: {
                  kind: "tx_workflow",
                  tx_block_direct_label: "action-label",
                  workflow: { name: "workflow", blocks: [] },
                },
              },
            ],
          },
        ],
      }),
    ),
  );
  assert.deepEqual(collectUnsupportedLabels(orchestrationJson), []);
});

test("transaction and orchestration form definitions expose no underscore labels", () => {
  for (const path of [
    "frontend/src/modules/transactions/transactionStructure.js",
    "frontend/src/modules/orchestration/orchestrationFormFieldState.js",
  ]) {
    const contents = source(path);
    assert.doesNotMatch(contents, /fieldKey: "[^"]*_label"/, path);
    assert.doesNotMatch(contents, /jsonPath: "[^"]*_label"/, path);
  }

  const commandEditor = source(
    "frontend/src/pages/orchestrated/TxBlockCommandEditor.svelte",
  );
  assert.doesNotMatch(commandEditor, /txBlockFormCommandExtra/);
  assert.doesNotMatch(commandEditor, /JsonObjectFieldsEditor/);
});

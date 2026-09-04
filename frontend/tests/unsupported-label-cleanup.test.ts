import assert from "node:assert/strict";
import test from "node:test";
import {
  txBlockFormModelFromJson,
  txBlockFormModelToJsonText,
} from "../src/domains/transactions/index.js";
import {
  txWorkflowFormModelFromJson,
  txWorkflowFormModelToJsonText,
} from "../src/domains/transactions/index.js";
import {
  orchestrationPlanFormModelFromJson,
  orchestrationPlanFormModelToJsonText,
} from "../src/domains/orchestration/index.js";

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

function collectUnsupportedLabels(value: JsonValue, path = ""): string[] {
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
  const jsonText = txBlockFormModelToJsonText(txBlockFormModelFromJson(block));
  const json = JSON.parse(jsonText) as JsonValue;

  assert.deepEqual(collectUnsupportedLabels(json), []);
  assert.doesNotMatch(jsonText, /"command_extension"/);
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
  ) as JsonValue;
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
  ) as JsonValue;
  assert.deepEqual(collectUnsupportedLabels(orchestrationJson), []);
});

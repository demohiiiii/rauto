import assert from "node:assert/strict";
import test from "node:test";

import {
  ORCHESTRATION_JOB_FIELD_DEFS,
  ORCHESTRATION_ROOT_FIELD_DEFS,
  ORCHESTRATION_STAGE_FIELD_DEFS,
  orchestrationJobFieldPatch,
  orchestrationJobFieldsDisplay,
  orchestrationStageFieldPatch,
  orchestrationStageFieldsDisplay,
} from "../src/domains/orchestration/index.js";
import {
  orchestrationPlanFormModelFromJson,
  orchestrationPlanFormModelFromJsonText,
  orchestrationPlanFormModelToJsonText,
} from "../src/domains/orchestration/index.js";

interface SerializedOrchestrationPlan {
  stages: Array<{
    jobs: Array<{
      action: {
        kind: string;
        workflow?: object;
        workflow_template_name?: string;
        workflow_vars?: object;
      };
    }>;
  }>;
}

test("orchestration scalar forms match the backend plan stage and job fields", () => {
  assert.deepEqual(
    ORCHESTRATION_ROOT_FIELD_DEFS.map((field) => field.fieldKey),
    [
      "name",
      "failFast",
      "rollbackOnStageFailure",
      "rollbackCompletedStagesOnFailure",
    ],
  );
  assert.deepEqual(
    ORCHESTRATION_STAGE_FIELD_DEFS.map((field) => field.fieldKey),
    ["name", "strategy", "maxParallel", "failFast"],
  );
  assert.deepEqual(
    ORCHESTRATION_JOB_FIELD_DEFS.map((field) => field.fieldKey),
    ["name", "strategy", "maxParallel", "failFast"],
  );
});

test("optional stage and job values use blank values instead of presence toggles", () => {
  for (const display of [
    orchestrationStageFieldsDisplay(
      {
        name: "deploy",
        strategy: "serial",
        maxParallel: null,
        failFast: null,
      },
      ["serial", "parallel"],
      ["true", "false"],
    ),
    orchestrationJobFieldsDisplay(
      {
        name: null,
        strategy: "serial",
        maxParallel: null,
        failFast: null,
      },
      ["serial", "parallel"],
      ["true", "false"],
    ),
  ]) {
    const maxParallel = display.find(
      (field) => field.fieldKey === "maxParallel",
    );
    const failFast = display.find((field) => field.fieldKey === "failFast");
    assert.ok(maxParallel);
    assert.ok(failFast);
    assert.equal(maxParallel.enabled, true);
    assert.equal(maxParallel.valueText, "");
    assert.equal(maxParallel.showPresenceToggle, false);
    assert.equal(failFast.enabled, true);
    assert.equal(failFast.valueText, "");
    assert.equal(failFast.showPresenceToggle, false);
    assert.ok(failFast.optionRows);
    assert.deepEqual(
      failFast.optionRows.map((option) => option.optionValue),
      ["", "true", "false"],
    );
  }

  assert.deepEqual(orchestrationStageFieldPatch("maxParallel", ""), {
    maxParallel: null,
    hasMaxParallel: false,
  });
  assert.deepEqual(orchestrationStageFieldPatch("failFast", ""), {
    failFast: null,
    hasFailFast: false,
  });
  assert.deepEqual(orchestrationJobFieldPatch("failFast", "false"), {
    failFast: false,
    hasFailFast: true,
  });
});

test("orchestration target JSON accepts names and rejects custom objects", () => {
  const model = orchestrationPlanFormModelFromJson({
    stages: [
      {
        name: "deploy",
        jobs: [
          {
            targets: ["edge-a", "edge-b"],
            action: {
              kind: "tx_workflow",
              workflow: { name: "workflow", blocks: [] },
            },
          },
        ],
      },
    ],
  });
  assert.deepEqual(model.stages[0].jobs[0].targets, ["edge-a", "edge-b"]);

  const invalid = orchestrationPlanFormModelFromJsonText(
    JSON.stringify({
      stages: [
        {
          name: "deploy",
          jobs: [
            {
              targets: [{ host: "192.0.2.10" }],
              action: {
                kind: "tx_workflow",
                workflow: { name: "workflow", blocks: [] },
              },
            },
          ],
        },
      ],
    }),
  );
  assert.match(invalid.error, /saved connection name/i);
  assert.equal(invalid.model, null);
});

test("orchestration action round trips contain only backend fields", () => {
  const model = orchestrationPlanFormModelFromJson({
    name: "plan",
    stages: [
      {
        name: "stage",
        jobs: [
          {
            action: {
              kind: "tx_workflow",
              workflow: { name: "inline", blocks: [] },
            },
          },
          {
            action: {
              kind: "tx_workflow",
              workflow_template_name: "workflow-template",
              workflow_vars: { site: "dc1" },
            },
          },
        ],
      },
    ],
  });
  const json = JSON.parse(
    orchestrationPlanFormModelToJsonText(model),
  ) as SerializedOrchestrationPlan;
  const [inlineAction, templateAction] = json.stages[0].jobs.map(
    (job) => job.action,
  );

  assert.deepEqual(Object.keys(inlineAction).sort(), ["kind", "workflow"]);
  assert.deepEqual(Object.keys(templateAction).sort(), [
    "kind",
    "workflow_template_name",
    "workflow_vars",
  ]);
});

test("orchestration model rejects removed action kinds and sources", () => {
  for (const action of [
    { kind: "tx_block", commands: ["show version"] },
    { kind: "tx_workflow", workflow_file: "workflow.json" },
    { kind: "tx_workflow", workflow_template_content: "{}" },
    {
      kind: "tx_workflow",
      name: "redundant",
      workflow: { name: "workflow", blocks: [] },
    },
  ]) {
    const result = orchestrationPlanFormModelFromJsonText(
      JSON.stringify({
        name: "plan",
        stages: [{ name: "stage", jobs: [{ action }] }],
      }),
    );
    assert.equal(result.model, null);
    assert.match(result.error, /unsupported orchestration action/i);
  }
});

test("orchestration model rejects values outside backend field types", () => {
  for (const job of [
    {
      name: 42,
      action: {
        kind: "tx_workflow",
        workflow: { name: "workflow", blocks: [] },
      },
    },
    {
      action: {
        kind: "tx_workflow",
        workflow: [],
      },
    },
  ]) {
    const result = orchestrationPlanFormModelFromJsonText(
      JSON.stringify({
        name: "plan",
        stages: [{ name: "stage", jobs: [job] }],
      }),
    );

    assert.equal(result.model, null);
    assert.match(result.error, /(job name|workflow must be an object)/i);
  }
});

test("orchestration model rejects non-object JSON roots", () => {
  for (const jsonText of ["null", "[]", "42", '"plan"']) {
    const result = orchestrationPlanFormModelFromJsonText(jsonText);

    assert.equal(result.model, null);
    assert.match(result.error, /orchestration plan must be a JSON object/);
  }
});

test("orchestration round trip drops unsupported fields at every model level", () => {
  const model = orchestrationPlanFormModelFromJson({
    name: "plan",
    unsupported: "plan",
    inventory_file: "./legacy-inventory.json",
    inventory: {
      unsupported: "inventory",
      defaults: {
        username: "admin",
        unsupported: "defaults",
      },
      groups: {
        core: {
          unsupported: "group",
          defaults: {
            port: 22,
            unsupported: "group-defaults",
          },
          targets: [
            {
              host: "10.0.0.1",
              unsupported: "target",
            },
          ],
        },
      },
    },
    stages: [
      {
        name: "stage",
        unsupported: "stage",
        jobs: [
          {
            unsupported: "job",
            targets: ["edge-a"],
            action: {
              kind: "tx_workflow",
              workflow: { name: "workflow", blocks: [] },
            },
          },
        ],
      },
    ],
  });
  const jsonText = orchestrationPlanFormModelToJsonText(model);

  assert.equal(model.inventory, undefined);
  assert.equal(model.inventoryFile, undefined);
  assert.doesNotMatch(jsonText, /"inventory"/);
  assert.doesNotMatch(jsonText, /"inventory_file"/);
  assert.doesNotMatch(jsonText, /unsupported/);
});

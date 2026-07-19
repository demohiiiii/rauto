import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ORCHESTRATION_JOB_FIELD_DEFS,
  ORCHESTRATION_ROOT_FIELD_DEFS,
  ORCHESTRATION_STAGE_FIELD_DEFS,
  orchestrationJobFieldPatch,
  orchestrationJobFieldsDisplay,
  orchestrationStageFieldPatch,
  orchestrationStageFieldsDisplay,
} from "../src/modules/orchestration/orchestrationFormFieldState.js";
import {
  orchestrationPlanFormModelFromJson,
  orchestrationPlanFormModelFromJsonText,
  orchestrationPlanFormModelToJsonText,
} from "../src/modules/orchestration/orchestrationPlanFormModels.js";

function read(path) {
  return readFileSync(path, "utf8");
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

test("orchestration settings omit metadata extra fields and presence controls", () => {
  const planEditor = read(
    "frontend/src/pages/orchestrated/OrchestrationPlanSettingsEditor.svelte",
  );
  const stageEditor = read(
    "frontend/src/pages/orchestrated/OrchestrationStageSettingsEditor.svelte",
  );
  const jobEditor = read(
    "frontend/src/pages/orchestrated/OrchestrationJobSettingsEditor.svelte",
  );

  for (const source of [planEditor, stageEditor, jobEditor]) {
    assert.doesNotMatch(
      source,
      /metadataFieldRows|extraField|JsonObjectFieldsEditor/,
    );
    assert.match(source, /presenceControlsMode="hidden"/);
  }
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
    assert.equal(maxParallel.enabled, true);
    assert.equal(maxParallel.valueText, "");
    assert.equal(maxParallel.showPresenceToggle, false);
    assert.equal(failFast.enabled, true);
    assert.equal(failFast.valueText, "");
    assert.equal(failFast.showPresenceToggle, false);
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

test("job targets only use the saved connection picker", () => {
  const targetEditor = read(
    "frontend/src/pages/orchestrated/OrchestrationJobTargetsEditor.svelte",
  );

  assert.match(targetEditor, /CONNECTION_PICKER\.orchestrationTargets/);
  assert.doesNotMatch(
    targetEditor,
    /OrchestrationTargetInputEditor|targetInputKindRows|onTargetKindChange|JsonObjectFieldsEditor/,
  );
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

test("job target collections do not expose presence controls", () => {
  const jobTargetsEditor = read(
    "frontend/src/pages/orchestrated/OrchestrationJobTargetsEditor.svelte",
  );

  for (const source of [jobTargetsEditor]) {
    assert.doesNotMatch(source, /PresenceToggle|listPresenceHandler/);
    assert.doesNotMatch(
      source,
      /onFieldNullableModeChange=|onFieldPresenceChange=|onVarsPresenceChange=|onExtraChange=/,
    );
  }
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
  const json = JSON.parse(orchestrationPlanFormModelToJsonText(model));
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

test("orchestration action editor is workflow-only", () => {
  const jobActionEditor = read(
    "frontend/src/pages/orchestrated/OrchestrationJobActionEditor.svelte",
  );
  const workflowSourceEditor = read(
    "frontend/src/pages/orchestrated/OrchestrationTxWorkflowSourceEditor.svelte",
  );

  assert.match(jobActionEditor, /OrchestrationTxWorkflowActionEditor/);
  assert.doesNotMatch(
    jobActionEditor,
    /OrchestrationTxBlockActionEditor|actionKindField|PlainSelectField/,
  );
  assert.doesNotMatch(workflowSourceEditor, /workflowFile|templateContent/);
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
  const json = JSON.parse(jsonText);

  assert.equal(model.inventory, undefined);
  assert.equal(model.inventoryFile, undefined);
  assert.equal(json.inventory, undefined);
  assert.equal(json.inventory_file, undefined);
  assert.doesNotMatch(jsonText, /unsupported/);
});

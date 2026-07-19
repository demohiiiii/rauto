import assert from "node:assert/strict";
import test from "node:test";
import { jsonParseErrorDetail } from "../src/lib/jsonValue.js";
import {
  txBlockEditorFormStateFromJsonText,
  txBlockFormModelFromJson,
  txBlockFormModelToJsonText,
  validateTxBlockFormModel,
} from "../src/modules/transactions/transactionBlockFormModels.js";

test("minimal transaction form serializes every supported backend field", () => {
  const model = txBlockFormModelFromJson({
    name: "complete-output",
    rollback_policy: "none",
    steps: [
      {
        run: { kind: "command", mode: "Enable", command: "show version" },
      },
    ],
  });
  const json = JSON.parse(txBlockFormModelToJsonText(model));

  assert.equal(json.fail_fast, true);
  assert.equal(json.steps[0].rollback, null);
  assert.equal(json.steps[0].rollback_on_failure, false);
  assert.equal(json.steps[0].run.timeout, null);
  assert.deepEqual(json.steps[0].run.dyn_params, {});
  assert.deepEqual(json.steps[0].run.interaction, { prompts: [] });
  assert.equal(json.steps[0].run.multiline_mode, "split_lines");
  assert.equal(model.steps[0].run.command.multilineMode, "split_lines");
});

test("transaction commands normalize and serialize multiline modes", () => {
  const model = txBlockFormModelFromJson({
    name: "multiline",
    rollback_policy: {
      whole_resource: {
        rollback: {
          kind: "command",
          mode: "Config",
          command: "configure replace backup.cfg\nend",
          multiline_mode: "whole",
        },
      },
    },
    steps: [
      {
        run: {
          kind: "command",
          mode: "Config",
          command: "interface Gi0/1\nno shutdown",
        },
        rollback: {
          kind: "command",
          mode: "Config",
          command: "default interface Gi0/1\nend",
          multiline_mode: "whole",
        },
      },
      {
        run: {
          kind: "flow",
          steps: [
            {
              mode: "Enable",
              command: "show version\nshow inventory",
              multiline_mode: "split_lines",
            },
          ],
        },
      },
    ],
  });
  const json = JSON.parse(txBlockFormModelToJsonText(model));

  assert.equal(model.steps[0].run.command.multilineMode, "split_lines");
  assert.equal(model.steps[0].rollback.command.multilineMode, "whole");
  assert.equal(model.steps[1].run.flow.steps[0].multilineMode, "split_lines");
  assert.equal(
    model.rollbackPolicy.wholeResource.rollback.command.multilineMode,
    "whole",
  );
  assert.equal(json.steps[0].run.multiline_mode, "split_lines");
  assert.equal(json.steps[0].rollback.multiline_mode, "whole");
  assert.equal(json.steps[1].run.steps[0].multiline_mode, "split_lines");
  assert.equal(
    json.rollback_policy.whole_resource.rollback.multiline_mode,
    "whole",
  );
});

test("transaction commands reject unsupported multiline modes", () => {
  assert.throws(
    () =>
      txBlockFormModelFromJson({
        name: "invalid-multiline",
        rollback_policy: "none",
        steps: [
          {
            run: {
              kind: "command",
              mode: "Enable",
              command: "show version",
              multiline_mode: "batch",
            },
          },
        ],
      }),
    /multiline_mode must be split_lines or whole/,
  );
});

test("rejects removed transaction template operations", () => {
  assert.throws(
    () =>
      txBlockFormModelFromJson({
        name: "removed-template-operation",
        rollback_policy: "none",
        steps: [
          {
            run: {
              kind: "template",
              template: { name: "legacy", steps: [] },
              runtime: { vars: {} },
            },
          },
        ],
      }),
    /unsupported transaction operation kind: template/,
  );
});

const completeTxBlock = {
  name: "fixture-block",
  fail_fast: true,
  root_extension: { owner: "network-ops" },
  rollback_policy: {
    whole_resource: {
      trigger_step_index: 0,
      policy_extension: "restore-snapshot",
      rollback: {
        kind: "command",
        mode: "Enable",
        command: "configure replace flash:backup.cfg force",
        timeout: 60,
        command_extension: 1,
        dyn_params: { enable_password: "", custom_prompt: "continue" },
        interaction: {
          interaction_extension: true,
          prompts: [
            {
              patterns: ["confirm", "Continue?"],
              response: "yes",
              record_input: false,
              prompt_extension: "rollback-confirmation",
            },
          ],
        },
      },
    },
  },
  steps: [
    {
      step_extension: "command-step",
      rollback_on_failure: true,
      run: {
        kind: "command",
        mode: "Enable",
        command: "show running-config",
        timeout: 30,
        command_extension: { captures: "running-config" },
        dyn_params: { sudo_password: "", pager: "off" },
        interaction: {
          prompts: [
            {
              patterns: ["Press RETURN"],
              response: "\n",
              record_input: true,
              prompt_extension: 2,
            },
          ],
        },
      },
      rollback: {
        kind: "command",
        mode: "Enable",
        command: "clear logging",
        rollback_extension: "command-rollback",
      },
    },
    {
      step_extension: "flow-step",
      run: {
        kind: "flow",
        stop_on_error: false,
        max_steps: 2,
        flow_extension: ["precheck"],
        steps: [
          {
            mode: "Enable",
            command: "show ip route",
            timeout: 20,
            flow_command_extension: "route-check",
            dyn_params: { pager: "off" },
            interaction: {
              interaction_extension: "flow-interaction",
              prompts: [
                {
                  patterns: ["More"],
                  response: " ",
                  prompt_extension: false,
                },
              ],
            },
          },
        ],
      },
      rollback: null,
      rollback_on_failure: false,
    },
  ],
};

test("normalizes complete transaction JSON and drops unsupported root fields", () => {
  const model = txBlockFormModelFromJson(completeTxBlock);
  const roundTripped = JSON.parse(txBlockFormModelToJsonText(model));
  const normalizedAgain = JSON.parse(
    txBlockFormModelToJsonText(txBlockFormModelFromJson(roundTripped)),
  );

  assert.deepEqual(normalizedAgain, roundTripped);
  assert.equal(Object.hasOwn(roundTripped, "root_extension"), false);
  assert.equal(
    roundTripped.rollback_policy.whole_resource.policy_extension,
    "restore-snapshot",
  );
  assert.equal(
    Object.hasOwn(roundTripped.steps[0].run, "command_extension"),
    false,
  );
  assert.equal(roundTripped.steps[1].run.flow_extension[0], "precheck");
});

test("drops unsupported transaction metadata and root fields", () => {
  const model = txBlockFormModelFromJson({
    name: "legacy-labels",
    root_label: "change-window",
    root_extension: "keep-root",
    rollback_policy: {
      whole_resource: {
        trigger_step_index: 0,
        reason: "legacy reason",
        policy_extension: "keep-policy",
        rollback: {
          kind: "command",
          mode: "Enable",
          command: "configure replace backup.cfg",
          rollback_label: "whole-resource-rollback",
          rollback_extension: "keep-whole-rollback",
        },
      },
    },
    steps: [
      {
        run: {
          kind: "command",
          mode: "Enable",
          command: "show version",
          command_label: "show-version",
          command_extension: "keep-command",
          interaction: {
            interaction_label: "confirm",
            interaction_extension: "keep-interaction",
            prompts: [],
          },
        },
        rollback: {
          kind: "command",
          mode: "Enable",
          command: "clear logging",
          rollback_label: "step-rollback",
          rollback_extension: "keep-step-rollback",
        },
        step_label: "legacy-step",
        step_extension: "keep-step",
      },
    ],
  });
  const json = JSON.parse(txBlockFormModelToJsonText(model));

  assert.equal(Object.hasOwn(json, "root_label"), false);
  assert.equal(Object.hasOwn(json.steps[0].run, "command_label"), false);
  assert.equal(
    Object.hasOwn(json.steps[0].run.interaction, "interaction_label"),
    false,
  );
  assert.equal(
    Object.hasOwn(json.rollback_policy.whole_resource, "reason"),
    false,
  );
  assert.equal(
    Object.hasOwn(
      json.rollback_policy.whole_resource.rollback,
      "rollback_label",
    ),
    false,
  );
  assert.equal(Object.hasOwn(json.steps[0].rollback, "rollback_label"), false);
  assert.equal(Object.hasOwn(json.steps[0], "step_label"), false);
  assert.equal(Object.hasOwn(json, "root_extension"), false);
  assert.equal(
    json.rollback_policy.whole_resource.policy_extension,
    "keep-policy",
  );
  assert.equal(
    Object.hasOwn(
      json.rollback_policy.whole_resource.rollback,
      "rollback_extension",
    ),
    false,
  );
  assert.equal(Object.hasOwn(json.steps[0].run, "command_extension"), false);
  assert.equal(
    json.steps[0].run.interaction.interaction_extension,
    "keep-interaction",
  );
  assert.equal(
    Object.hasOwn(json.steps[0].rollback, "rollback_extension"),
    false,
  );
  assert.equal(Object.hasOwn(json.steps[0], "step_extension"), false);
});

test("reports JSON parse locations from native line/column and position messages", () => {
  assert.deepEqual(
    jsonParseErrorDetail("{\n  bad\n}", {
      message: "Expected property name at line 2 column 3 of the JSON data",
    }),
    {
      message: "Expected property name at line 2 column 3 of the JSON data",
      line: 2,
      column: 3,
    },
  );

  assert.deepEqual(
    jsonParseErrorDetail('{\n  "name": "tx",\n  bad\n}', {
      message: "Unexpected token 'b', at position 20",
    }),
    {
      message: "Unexpected token 'b', at position 20",
      line: 3,
      column: 3,
    },
  );

  assert.deepEqual(jsonParseErrorDetail("{}", new Error("Invalid JSON")), {
    message: "Invalid JSON",
    line: null,
    column: null,
  });
});

test("reports JSON parse locations from Chrome context-only messages", () => {
  const jsonText = '{\n  "name": "broken",\n  "steps": [}\n';
  const messages = [
    `Unexpected token '}', ...""steps": [}\n" is not valid JSON`,
    `Unexpected token '}', ...\\"\\"steps\\": [}\\n\\" is not valid JSON`,
    `Unexpected token '}', …""name": "broken",\n  "steps": [}\n"... is not valid JSON`,
  ];

  for (const message of messages) {
    assert.deepEqual(jsonParseErrorDetail(jsonText, { message }), {
      message,
      line: 3,
      column: 13,
    });
  }
});

test("reports Chrome parse locations from beginning-of-input contexts", () => {
  const cases = [
    {
      jsonText: '{"bad":}',
      message: `Unexpected token '}', "{"bad":}" is not valid JSON`,
      line: 1,
      column: 8,
    },
    {
      jsonText: "<html>",
      message: `Unexpected token '<', "<html>" is not valid JSON`,
      line: 1,
      column: 1,
    },
    {
      jsonText: "<!DOCTYPE html><html><body>error</body></html>",
      message: `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`,
      line: 1,
      column: 1,
    },
  ];

  for (const { jsonText, message, line, column } of cases) {
    assert.deepEqual(jsonParseErrorDetail(jsonText, { message }), {
      message,
      line,
      column,
    });
  }
});

test("does not guess a repeated unexpected token without unique context", () => {
  const jsonText = '{\n  "first": },\n  "second": }\n}';
  const messages = [
    `Unexpected token '}', ..."}"... is not valid JSON`,
    `Unexpected token '}', "}" is not valid JSON`,
  ];

  for (const message of messages) {
    assert.deepEqual(jsonParseErrorDetail(jsonText, { message }), {
      message,
      line: null,
      column: null,
    });
  }
});

test("does not guess between conflicting escaped context variants", () => {
  const escapedContext = '\\"<html>\\"';
  const decodedContext = '"<html>"';
  const jsonText = `{"decoy":"${escapedContext}"}\n${decodedContext}`;
  const message = `Unexpected token '<', ${escapedContext} is not valid JSON`;

  assert.deepEqual(jsonParseErrorDetail(jsonText, { message }), {
    message,
    line: null,
    column: null,
  });
});

test("keeps the previous form model and exposes parse detail for invalid JSON", () => {
  const currentModel = txBlockFormModelFromJson(completeTxBlock);
  const invalidText = '{\n  "name": "draft",\n}';
  const state = txBlockEditorFormStateFromJsonText(invalidText, currentModel);

  assert.equal(state.formModel, currentModel);
  assert.equal(state.formError.length > 0, true);
  assert.equal(state.formErrorDetail.message, state.formError);
  assert.equal(state.formErrorDetail.line, 3);
  assert.equal(state.formErrorDetail.column, 1);
});

test("returns validation errors in stable execution order", () => {
  const invalid = structuredClone(completeTxBlock);
  invalid.steps = [
    {
      run: {
        kind: "flow",
        steps: [],
      },
    },
  ];
  invalid.rollback_policy.whole_resource.rollback.mode = "";
  invalid.rollback_policy.whole_resource.rollback.command = "";
  invalid.rollback_policy.whole_resource.trigger_step_index = 3;

  assert.deepEqual(
    validateTxBlockFormModel(txBlockFormModelFromJson(invalid)),
    [
      {
        path: "steps[0].run.flow.steps",
        messageKey: "txBlockValidationFlowSteps",
      },
      {
        path: "rollbackPolicy.wholeResource.rollback.command.mode",
        messageKey: "txBlockValidationCommandMode",
      },
      {
        path: "rollbackPolicy.wholeResource.rollback.command.command",
        messageKey: "txBlockValidationCommandText",
      },
      {
        path: "rollbackPolicy.wholeResource.triggerStepIndex",
        messageKey: "txBlockValidationTriggerRange",
      },
    ],
  );
});

test("validates command, flow, and rollback execution invariants", () => {
  const commandModel = txBlockFormModelFromJson({
    name: "invalid-operations",
    rollback_policy: "per_step",
    fail_fast: true,
    steps: [
      {
        run: { kind: "command", mode: "", command: "", timeout: -1 },
        rollback: {
          kind: "flow",
          steps: [{ mode: "Enable", command: "", timeout: 1.5 }],
        },
      },
    ],
  });

  assert.deepEqual(validateTxBlockFormModel(commandModel), [
    {
      path: "steps[0].run.command.mode",
      messageKey: "txBlockValidationCommandMode",
    },
    {
      path: "steps[0].run.command.command",
      messageKey: "txBlockValidationCommandText",
    },
    {
      path: "steps[0].run.command.timeout",
      messageKey: "txBlockValidationNonNegativeInteger",
    },
    {
      path: "steps[0].rollback.flow.steps[0].command",
      messageKey: "txBlockValidationCommandText",
    },
    {
      path: "steps[0].rollback.flow.steps[0].timeout",
      messageKey: "txBlockValidationNonNegativeInteger",
    },
  ]);

  assert.deepEqual(
    validateTxBlockFormModel(
      txBlockFormModelFromJson({
        name: "empty",
        rollback_policy: "none",
        steps: [],
        fail_fast: true,
      }),
    ),
    [{ path: "steps", messageKey: "txBlockValidationStepsRequired" }],
  );
});

test("validates command prompt pattern lists", () => {
  const invalid = structuredClone(completeTxBlock);
  invalid.steps = [
    {
      run: {
        kind: "command",
        mode: "Enable",
        command: "copy running-config startup-config",
        interaction: { prompts: [{ patterns: [], response: "yes" }] },
      },
    },
  ];
  invalid.rollback_policy = "none";

  assert.deepEqual(
    validateTxBlockFormModel(txBlockFormModelFromJson(invalid)),
    [
      {
        path: "steps[0].run.command.interaction.prompts[0].patterns",
        messageKey: "txBlockValidationPromptPatterns",
      },
    ],
  );
});

test("validates flow max steps as an optional non-negative safe integer", () => {
  const model = txBlockFormModelFromJson({
    name: "flow-max-steps",
    rollback_policy: "none",
    steps: [
      {
        run: {
          kind: "flow",
          max_steps: null,
          steps: [{ mode: "Enable", command: "show version" }],
        },
      },
    ],
    fail_fast: true,
  });
  const flow = model.steps[0].run.flow;
  const expectedError = [
    {
      path: "steps[0].run.flow.maxSteps",
      messageKey: "txBlockValidationNonNegativeInteger",
    },
  ];

  assert.equal(flow.hasMaxSteps, true);
  assert.deepEqual(validateTxBlockFormModel(model), []);

  for (const invalidValue of [
    -1,
    1.5,
    Number.NaN,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    flow.maxSteps = invalidValue;
    assert.deepEqual(validateTxBlockFormModel(model), expectedError);
  }

  for (const validValue of [0, 1, Number.MAX_SAFE_INTEGER]) {
    flow.maxSteps = validValue;
    assert.deepEqual(validateTxBlockFormModel(model), []);
  }
});

test("accepts backend defaults for nullable timeouts and rollback trigger index", () => {
  const model = txBlockFormModelFromJson({
    name: "backend-defaults",
    rollback_policy: {
      whole_resource: {
        rollback: {
          kind: "command",
          mode: "Enable",
          command: "configure replace flash:backup.cfg force",
          timeout: null,
        },
      },
    },
    steps: [
      {
        run: {
          kind: "command",
          mode: "Enable",
          command: "show version",
          timeout: null,
        },
      },
    ],
    fail_fast: true,
  });

  assert.deepEqual(validateTxBlockFormModel(model), []);
});

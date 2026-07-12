import assert from "node:assert/strict";
import test from "node:test";
import { jsonParseErrorDetail } from "../src/lib/jsonValue.js";
import {
  txBlockEditorFormStateFromJsonText,
  txBlockFormModelFromJson,
  txBlockFormModelToJsonText,
  validateTxBlockFormModel,
} from "../src/modules/transactionBlockFormModels.js";

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
    {
      step_extension: "template-step",
      run: {
        kind: "template",
        current_connection_alias: "primary",
        operation_extension: "template-operation",
        template: {
          name: "interface-check",
          description: "Inspect a selected interface",
          stop_on_error: true,
          default_mode: "Enable",
          template_extension: { revision: 3 },
          vars: [
            {
              name: "interface",
              label: "Interface",
              description: "Interface name",
              type: "string",
              required: true,
              placeholder: "GigabitEthernet0/1",
              options: ["GigabitEthernet0/1", "GigabitEthernet0/2"],
              default: "GigabitEthernet0/1",
              variable_extension: "inventory-backed",
            },
          ],
          steps: [
            {
              command: "show interface {{interface}}",
              mode: "Enable",
              timeout_secs: 45,
              template_step_extension: "inspect-interface",
              prompts: [
                {
                  patterns: ["confirm"],
                  response: "yes",
                  append_newline: true,
                  record_input: false,
                  prompt_extension: { audit: true },
                },
              ],
            },
          ],
        },
        runtime: {
          default_mode: "Enable",
          connection_name: "edge-01",
          host: "192.0.2.10",
          username: "operator",
          device_profile: "cisco_ios",
          vars: {
            interface: "GigabitEthernet0/2",
            nested: { dry_run: true },
          },
          runtime_extension: ["ticket-123"],
        },
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
  assert.equal(
    roundTripped.steps[2].run.template.template_extension.revision,
    3,
  );
  assert.equal(
    roundTripped.steps[2].run.runtime.runtime_extension[0],
    "ticket-123",
  );
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

test("validates command, flow, template, and rollback execution invariants", () => {
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
      {
        run: {
          kind: "template",
          template: { name: "", vars: [{ name: "" }], steps: [] },
          runtime: {},
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
    {
      path: "steps[1].run.template.template.name",
      messageKey: "txBlockValidationTemplateName",
    },
    {
      path: "steps[1].run.template.template.steps",
      messageKey: "txBlockValidationTemplateSteps",
    },
    {
      path: "steps[1].run.template.template.vars[0].name",
      messageKey: "txBlockValidationVariableName",
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

test("validates command and template prompt pattern lists", () => {
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
    {
      run: {
        kind: "template",
        template: {
          name: "prompt-template",
          default_mode: "Enable",
          steps: [
            {
              command: "write memory",
              prompts: [{ patterns: [], response: "yes" }],
            },
          ],
        },
        runtime: {},
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
      {
        path: "steps[1].run.template.template.steps[0].prompts[0].patterns",
        messageKey: "txBlockValidationPromptPatterns",
      },
    ],
  );
});

test("requires a template step mode only when every fallback is blank", () => {
  const templateBlock = (template, runtime = {}) =>
    txBlockFormModelFromJson({
      name: "template-modes",
      rollback_policy: "none",
      steps: [{ run: { kind: "template", template, runtime } }],
      fail_fast: true,
    });
  const baseTemplate = {
    name: "mode-template",
    default_mode: " ",
    steps: [{ command: "show version", mode: "  " }],
  };

  assert.deepEqual(
    validateTxBlockFormModel(
      templateBlock(baseTemplate, { default_mode: " " }),
    ),
    [
      {
        path: "steps[0].run.template.template.steps[0].mode",
        messageKey: "txBlockValidationCommandMode",
      },
    ],
  );
  assert.deepEqual(
    validateTxBlockFormModel(
      templateBlock({
        ...baseTemplate,
        steps: [{ command: "show version", mode: "Enable" }],
      }),
    ),
    [],
  );
  assert.deepEqual(
    validateTxBlockFormModel(
      templateBlock({ ...baseTemplate, default_mode: "Enable" }),
    ),
    [],
  );
  assert.deepEqual(
    validateTxBlockFormModel(
      templateBlock(baseTemplate, { default_mode: "Enable" }),
    ),
    [],
  );
});

test("validates blank and duplicate template variable names in order", () => {
  const model = txBlockFormModelFromJson({
    name: "template-vars",
    rollback_policy: "none",
    steps: [
      {
        run: {
          kind: "template",
          template: {
            name: "variable-template",
            default_mode: "Enable",
            vars: [{ name: "hostname" }, { name: "" }, { name: "hostname" }],
            steps: [{ command: "show running-config" }],
          },
          runtime: {},
        },
      },
    ],
    fail_fast: true,
  });

  assert.deepEqual(validateTxBlockFormModel(model), [
    {
      path: "steps[0].run.template.template.vars[1].name",
      messageKey: "txBlockValidationVariableName",
    },
    {
      path: "steps[0].run.template.template.vars[2].name",
      messageKey: "txBlockValidationDuplicateVariable",
    },
  ]);
});

test("rejects preserved non-object template runtime vars", () => {
  const model = txBlockFormModelFromJson({
    name: "runtime-vars",
    rollback_policy: "none",
    steps: [
      {
        run: {
          kind: "template",
          template: {
            name: "runtime-template",
            default_mode: "Enable",
            steps: [{ command: "show version" }],
          },
          runtime: { vars: ["not", "an", "object"] },
        },
      },
    ],
    fail_fast: true,
  });

  assert.equal(Array.isArray(model.steps[0].run.template.runtime.vars), true);
  assert.equal(model.steps[0].run.template.runtime.hasVars, true);
  assert.deepEqual(validateTxBlockFormModel(model), [
    {
      path: "steps[0].run.template.runtime.vars",
      messageKey: "txBlockValidationRuntimeVarsObject",
    },
  ]);

  model.steps[0].run.template.runtime.vars = 42;
  assert.deepEqual(validateTxBlockFormModel(model), [
    {
      path: "steps[0].run.template.runtime.vars",
      messageKey: "txBlockValidationRuntimeVarsObject",
    },
  ]);
});

test("accepts null template runtime vars", () => {
  const model = txBlockFormModelFromJson({
    name: "nullable-runtime-vars",
    rollback_policy: "none",
    steps: [
      {
        run: {
          kind: "template",
          template: {
            name: "runtime-template",
            default_mode: "Enable",
            steps: [{ command: "show version" }],
          },
          runtime: { vars: null },
        },
      },
    ],
    fail_fast: true,
  });

  assert.equal(model.steps[0].run.template.runtime.vars, null);
  assert.equal(model.steps[0].run.template.runtime.hasVars, true);
  assert.deepEqual(validateTxBlockFormModel(model), []);
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

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFlowVarsPayload,
  flowVarsPresentation,
  getCurrentFlowTemplateFieldDraft,
  setFlowVarDraftValue,
  updateFlowTemplateVarFields,
} from "../src/domains/templates/index.js";
import type {
  FlowVarField,
  TemplateVariableField,
} from "../src/domains/templates/index.js";

function variableField(
  name: string,
  overrides: Partial<TemplateVariableField> = {},
): TemplateVariableField {
  return {
    allow_empty: false,
    default: null,
    description: null,
    label: name,
    name,
    options: [],
    placeholder: null,
    required: true,
    type: "string",
    ...overrides,
  };
}

function displayField(field: TemplateVariableField): FlowVarField {
  return {
    allowEmpty: field.allow_empty,
    defaultValue: field.default,
    description: field.description ?? "",
    kind: field.type,
    label: field.label,
    name: field.name,
    options: field.options,
    placeholder: field.placeholder ?? "",
    required: field.required,
  };
}

const runtimeSchema: TemplateVariableField[] = [
  variableField("command"),
  variableField("transfer_password", {
    allow_empty: true,
    type: "secret",
  }),
];

test("command flow runtime fields preserve explicit empty values", () => {
  updateFlowTemplateVarFields({ vars_schema: runtimeSchema }, {});
  setFlowVarDraftValue("command", "copy startup-config tftp:");

  assert.deepEqual(buildFlowVarsPayload(), {
    command: "copy startup-config tftp:",
    transfer_password: "",
  });
});

test("command flow runtime field display uses inferred schema", () => {
  const display = flowVarsPresentation({
    errorMessage: "",
    fields: runtimeSchema.map(displayField),
    hintText: "runtime vars",
    values: { command: "show version", transfer_password: "" },
  });

  assert.equal(display.hasFields, true);
  assert.equal(display.fieldRows[0]?.value, "show version");
  assert.equal(display.fieldRows[1]?.inputType, "password");
  assert.equal(display.fieldRows[1]?.allowsEmpty, true);
  assert.equal(Object.hasOwn(display, "jsonOverridesText"), false);
});

test("changing templates preserves schema order and removes unrelated values", () => {
  updateFlowTemplateVarFields(
    {
      vars_schema: [variableField("zeta"), variableField("alpha")],
    },
    { alpha: "a", stale: "remove", zeta: "z" },
  );

  assert.deepEqual(getCurrentFlowTemplateFieldDraft(), {
    zeta: "z",
    alpha: "a",
  });

  updateFlowTemplateVarFields(
    { vars_schema: [variableField("next")] },
    getCurrentFlowTemplateFieldDraft(),
  );

  assert.deepEqual(getCurrentFlowTemplateFieldDraft(), { next: "" });
});

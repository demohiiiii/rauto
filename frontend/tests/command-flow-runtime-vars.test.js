import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFlowVarsPayload,
  getCurrentFlowTemplateFieldDraft,
  setFlowVarDraftValue,
  updateFlowTemplateVarFields,
} from "../src/modules/templates/templatesFlowRuntimeState.js";
import { flowVarsPresentation } from "../src/modules/templates/templatesFlowDisplayState.js";

const runtimeSchema = [
  {
    allow_empty: false,
    name: "command",
    label: "command",
    required: true,
    type: "string",
  },
  {
    allow_empty: true,
    name: "transfer_password",
    label: "transfer_password",
    required: true,
    type: "secret",
  },
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
    fields: runtimeSchema.map((field) => ({
      allowEmpty: field.allow_empty,
      kind: field.type,
      label: field.label,
      name: field.name,
      required: field.required,
    })),
    hintText: "runtime vars",
    values: { command: "show version", transfer_password: "" },
  });

  assert.equal(display.hasFields, true);
  assert.equal(display.fieldRows[0].value, "show version");
  assert.equal(display.fieldRows[1].inputType, "password");
  assert.equal(display.fieldRows[1].allowsEmpty, true);
  assert.equal(Object.hasOwn(display, "jsonOverridesText"), false);
});

test("changing templates preserves schema order and removes unrelated values", () => {
  updateFlowTemplateVarFields(
    {
      vars_schema: [
        { name: "zeta", required: true, type: "string" },
        { name: "alpha", required: true, type: "string" },
      ],
    },
    { alpha: "a", stale: "remove", zeta: "z" },
  );

  assert.deepEqual(getCurrentFlowTemplateFieldDraft(), {
    zeta: "z",
    alpha: "a",
  });

  updateFlowTemplateVarFields(
    {
      vars_schema: [{ name: "next", required: true, type: "string" }],
    },
    getCurrentFlowTemplateFieldDraft(),
  );

  assert.deepEqual(getCurrentFlowTemplateFieldDraft(), { next: "" });
});

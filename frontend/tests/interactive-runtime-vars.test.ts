import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInteractiveVarsPayload,
  createInteractiveTemplateRuntime,
  interactiveVarsPresentation,
  getCurrentInteractiveTemplateFieldDraft,
  setInteractiveVarDraftValue,
  updateInteractiveTemplateVarFields,
} from "../src/domains/templates/index.js";
import type {
  InteractiveVarField,
  TemplateResourceApiMeta,
  TemplateVariableField,
} from "../src/domains/templates/index.js";
import { get } from "svelte/store";
import { templatesApi } from "../src/domains/templates/infrastructure/templatesApi.js";

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

function displayField(field: TemplateVariableField): InteractiveVarField {
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

test("interactive command runtime fields preserve explicit empty values", () => {
  updateInteractiveTemplateVarFields({ vars_schema: runtimeSchema }, {});
  setInteractiveVarDraftValue("command", "copy startup-config tftp:");

  assert.deepEqual(buildInteractiveVarsPayload(), {
    command: "copy startup-config tftp:",
    transfer_password: "",
  });
});

test("interactive command runtime field display uses inferred schema", () => {
  const display = interactiveVarsPresentation({
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
  updateInteractiveTemplateVarFields(
    {
      vars_schema: [variableField("zeta"), variableField("alpha")],
    },
    { alpha: "a", stale: "remove", zeta: "z" },
  );

  assert.deepEqual(getCurrentInteractiveTemplateFieldDraft(), {
    zeta: "z",
    alpha: "a",
  });

  updateInteractiveTemplateVarFields(
    { vars_schema: [variableField("next")] },
    getCurrentInteractiveTemplateFieldDraft(),
  );

  assert.deepEqual(getCurrentInteractiveTemplateFieldDraft(), { next: "" });
});

for (const staleFails of [false, true]) {
  test(`interactive catalog ignores stale ${staleFails ? "failed" : "successful"} refreshes`, async (t) => {
    const pending: {
      resolve: (items: TemplateResourceApiMeta[]) => void;
      reject: (error: Error) => void;
    }[] = [];
    t.mock.method(
      templatesApi,
      "listTemplateResource",
      () =>
        new Promise<TemplateResourceApiMeta[]>((resolve, reject) => {
          pending.push({ resolve, reject });
        }),
    );
    const runtime = createInteractiveTemplateRuntime();
    const older = runtime.loadInteractiveTemplates();
    const newer = runtime.loadInteractiveTemplates();
    const meta = (name: string): TemplateResourceApiMeta => ({
      name,
      kind: "interactive",
      source: "custom",
      content_type: "application/toml",
      size_bytes: 0,
      created_at_ms: 0,
      updated_at_ms: 0,
    });
    runtime.runInteractiveTemplateSelectState.set({
      options: [],
      selected: "draft",
    });
    pending[2].resolve([meta("latest")]);
    pending[3].resolve([meta("copy")]);
    await newer;
    if (staleFails) {
      pending[0].reject(new Error("old request failed"));
      pending[1].reject(new Error("old request failed"));
    } else {
      pending[0].resolve([meta("deleted")]);
      pending[1].resolve([]);
    }
    await older;
    assert.deepEqual(get(runtime.runInteractiveTemplateSelectState), {
      options: ["latest", "builtin:copy"],
      selected: "draft",
    });
  });
}

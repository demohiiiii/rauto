import { parse, stringify } from "smol-toml";
import { plainObject, stringValue } from "../lib/jsonValue.js";

const ROOT_FIELDS = new Set(["name", "stop_on_error", "default_mode", "steps"]);
const STEP_FIELDS = new Set(["command", "mode", "timeout_secs", "prompts"]);
const PROMPT_FIELDS = new Set([
  "patterns",
  "response",
  "append_newline",
  "record_input",
]);

function assertPlainObject(value, label) {
  if (!plainObject(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function assertSupportedFields(source, supportedFields, scope = "") {
  for (const field of Object.keys(source)) {
    if (!supportedFields.has(field)) {
      const path = scope ? `${scope}.${field}` : field;
      throw new Error(`unsupported command flow field: ${path}`);
    }
  }
}

function optionalStringField(source, field) {
  const present = Object.hasOwn(source, field);
  const value = present ? source[field] : null;
  if (value != null && typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }
  return { present, value };
}

export function defaultCommandFlowTemplatePromptModel() {
  return {
    patterns: [""],
    response: "",
    appendNewline: true,
    recordInput: false,
  };
}

export function defaultCommandFlowTemplateStepModel() {
  return {
    command: "",
    mode: null,
    hasMode: false,
    timeoutSecs: null,
    hasTimeoutSecs: false,
    prompts: [],
  };
}

export function defaultCommandFlowTemplateModel() {
  return {
    name: "temporary-flow",
    stopOnError: true,
    defaultMode: null,
    hasDefaultMode: false,
    steps: [defaultCommandFlowTemplateStepModel()],
  };
}

function commandFlowPromptModelFromDocument(prompt, promptIndex, stepIndex) {
  const source = assertPlainObject(
    prompt,
    `steps[${stepIndex}].prompts[${promptIndex}]`,
  );
  assertSupportedFields(
    source,
    PROMPT_FIELDS,
    `steps[${stepIndex}].prompts[${promptIndex}]`,
  );
  if (!Array.isArray(source.patterns)) {
    throw new Error(
      `steps[${stepIndex}].prompts[${promptIndex}].patterns must be an array`,
    );
  }
  return {
    patterns: source.patterns.map((pattern) => stringValue(pattern)),
    response: stringValue(source.response),
    appendNewline: source.append_newline === true,
    recordInput: source.record_input === true,
  };
}

function commandFlowStepModelFromDocument(step, stepIndex) {
  const source = assertPlainObject(step, `steps[${stepIndex}]`);
  assertSupportedFields(source, STEP_FIELDS, `steps[${stepIndex}]`);
  const mode = optionalStringField(source, "mode");
  const hasTimeoutSecs = Object.hasOwn(source, "timeout_secs");
  const timeoutSecs = hasTimeoutSecs ? source.timeout_secs : null;
  if (
    timeoutSecs != null &&
    (!Number.isSafeInteger(timeoutSecs) || timeoutSecs < 0)
  ) {
    throw new Error(
      `steps[${stepIndex}].timeout_secs must be a non-negative integer`,
    );
  }
  const prompts = Array.isArray(source.prompts) ? source.prompts : [];
  return {
    command: stringValue(source.command),
    mode: mode.value,
    hasMode: mode.present,
    timeoutSecs,
    hasTimeoutSecs,
    prompts: prompts.map((prompt, promptIndex) =>
      commandFlowPromptModelFromDocument(prompt, promptIndex, stepIndex),
    ),
  };
}

export function commandFlowTemplateModelFromDocument(document = {}) {
  const source = assertPlainObject(document, "command flow template");
  assertSupportedFields(source, ROOT_FIELDS);
  const defaultMode = optionalStringField(source, "default_mode");
  const steps = Array.isArray(source.steps) ? source.steps : [];
  return {
    name: stringValue(source.name),
    stopOnError:
      typeof source.stop_on_error === "boolean" ? source.stop_on_error : true,
    defaultMode: defaultMode.value,
    hasDefaultMode: defaultMode.present,
    steps: steps.map(commandFlowStepModelFromDocument),
  };
}

export function commandFlowTemplateModelFromToml(tomlText = "") {
  return commandFlowTemplateModelFromDocument(parse(stringValue(tomlText)));
}

export function normalizeLoadedCommandFlowTemplateToml(tomlText = "") {
  const document = assertPlainObject(
    parse(stringValue(tomlText)),
    "command flow template",
  );
  delete document.description;
  return stringify(document);
}

function commandFlowPromptDocumentFromModel(prompt = {}) {
  return {
    patterns: Array.isArray(prompt.patterns)
      ? prompt.patterns.map((pattern) => stringValue(pattern))
      : [],
    response: stringValue(prompt.response),
    append_newline: !!prompt.appendNewline,
    record_input: !!prompt.recordInput,
  };
}

function commandFlowStepDocumentFromModel(step = {}) {
  const document = {
    command: stringValue(step.command),
  };
  if (step.hasMode || step.mode !== null) {
    document.mode = step.mode ?? "";
  }
  if (step.hasTimeoutSecs || step.timeoutSecs !== null) {
    document.timeout_secs = step.timeoutSecs ?? 0;
  }
  document.prompts = Array.isArray(step.prompts)
    ? step.prompts.map(commandFlowPromptDocumentFromModel)
    : [];
  return document;
}

export function commandFlowTemplateDocumentFromModel(model = {}) {
  const document = {
    name: stringValue(model.name),
  };
  document.stop_on_error = model.stopOnError !== false;
  if (model.hasDefaultMode || model.defaultMode !== null) {
    document.default_mode = model.defaultMode ?? "";
  }
  document.steps = Array.isArray(model.steps)
    ? model.steps.map(commandFlowStepDocumentFromModel)
    : [];
  return document;
}

export function commandFlowTemplateModelToToml(model = {}) {
  return stringify(commandFlowTemplateDocumentFromModel(model));
}

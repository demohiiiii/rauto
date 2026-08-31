import { parse, stringify } from "smol-toml";
import type {
  CommandFlowMultilineMode,
  CommandFlowPromptDocument,
  CommandFlowStepDocument,
  CommandFlowTemplateDocument,
  CommandFlowTemplateModel,
  CommandFlowTemplatePromptModel,
  CommandFlowTemplateStepModel,
} from "./types.js";

const ROOT_FIELDS = new Set(["name", "stop_on_error", "default_mode", "steps"]);
const STEP_FIELDS = new Set([
  "command",
  "multiline_mode",
  "mode",
  "timeout_secs",
  "prompts",
]);
const PROMPT_FIELDS = new Set([
  "patterns",
  "response",
  "append_newline",
  "record_input",
]);

function plainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function assertPlainObject(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (!plainObject(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function assertSupportedFields(
  source: Record<string, unknown>,
  supportedFields: ReadonlySet<string>,
  scope = "",
): void {
  for (const field of Object.keys(source)) {
    if (!supportedFields.has(field)) {
      const path = scope ? `${scope}.${field}` : field;
      throw new Error(`unsupported command flow field: ${path}`);
    }
  }
}

function optionalStringField(
  source: Record<string, unknown>,
  field: string,
): { present: boolean; value: string | null } {
  const present = Object.hasOwn(source, field);
  const value = present ? source[field] : null;
  if (value == null) return { present, value: null };
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }
  return { present, value };
}

function multilineModeValue(
  value: unknown,
  path: string,
): CommandFlowMultilineMode {
  if (value == null || value === "") return "split_lines";
  if (value === "split_lines" || value === "whole") return value;
  throw new Error(`${path} must be split_lines or whole`);
}

export function defaultCommandFlowTemplatePromptModel(): CommandFlowTemplatePromptModel {
  return {
    patterns: [""],
    response: "",
    appendNewline: true,
    recordInput: false,
  };
}

export function defaultCommandFlowTemplateStepModel(): CommandFlowTemplateStepModel {
  return {
    command: "",
    multilineMode: "split_lines",
    mode: null,
    hasMode: false,
    timeoutSecs: null,
    hasTimeoutSecs: false,
    prompts: [],
  };
}

export function defaultCommandFlowTemplateModel(): CommandFlowTemplateModel {
  return {
    name: "temporary-flow",
    stopOnError: true,
    defaultMode: null,
    hasDefaultMode: false,
    steps: [defaultCommandFlowTemplateStepModel()],
  };
}

function commandFlowPromptModelFromDocument(
  prompt: unknown,
  promptIndex: number,
  stepIndex: number,
): CommandFlowTemplatePromptModel {
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

function commandFlowStepModelFromDocument(
  step: unknown,
  stepIndex: number,
): CommandFlowTemplateStepModel {
  const source = assertPlainObject(step, `steps[${stepIndex}]`);
  assertSupportedFields(source, STEP_FIELDS, `steps[${stepIndex}]`);
  const mode = optionalStringField(source, "mode");
  const hasTimeoutSecs = Object.hasOwn(source, "timeout_secs");
  const timeoutSecs = hasTimeoutSecs ? source.timeout_secs : null;
  if (
    timeoutSecs != null &&
    (!Number.isSafeInteger(timeoutSecs) || Number(timeoutSecs) < 0)
  ) {
    throw new Error(
      `steps[${stepIndex}].timeout_secs must be a non-negative integer`,
    );
  }
  const prompts = Array.isArray(source.prompts) ? source.prompts : [];
  return {
    command: stringValue(source.command),
    multilineMode: multilineModeValue(
      source.multiline_mode,
      `steps[${stepIndex}].multiline_mode`,
    ),
    mode: mode.value,
    hasMode: mode.present,
    timeoutSecs: timeoutSecs == null ? null : Number(timeoutSecs),
    hasTimeoutSecs,
    prompts: prompts.map((prompt, promptIndex) =>
      commandFlowPromptModelFromDocument(prompt, promptIndex, stepIndex),
    ),
  };
}

export function commandFlowTemplateModelFromDocument(
  document: unknown = {},
): CommandFlowTemplateModel {
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

export function commandFlowTemplateModelFromToml(
  tomlText = "",
): CommandFlowTemplateModel {
  return commandFlowTemplateModelFromDocument(parse(stringValue(tomlText)));
}

export function normalizeLoadedCommandFlowTemplateToml(tomlText = ""): string {
  const document = assertPlainObject(
    parse(stringValue(tomlText)),
    "command flow template",
  );
  delete document.description;
  return stringify(document);
}

function promptModel(value: unknown): Partial<CommandFlowTemplatePromptModel> {
  return plainObject(value) ? value : {};
}

function stepModel(value: unknown): Partial<CommandFlowTemplateStepModel> {
  return plainObject(value) ? value : {};
}

function commandFlowPromptDocumentFromModel(
  value: unknown = {},
): CommandFlowPromptDocument {
  const prompt = promptModel(value);
  return {
    patterns: Array.isArray(prompt.patterns)
      ? prompt.patterns.map((pattern) => stringValue(pattern))
      : [],
    response: stringValue(prompt.response),
    append_newline: !!prompt.appendNewline,
    record_input: !!prompt.recordInput,
  };
}

function commandFlowStepDocumentFromModel(
  value: unknown = {},
): CommandFlowStepDocument {
  const step = stepModel(value);
  const document: CommandFlowStepDocument = {
    command: stringValue(step.command),
    multiline_mode: multilineModeValue(
      step.multilineMode,
      "step.multiline_mode",
    ),
    prompts: [],
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

export function commandFlowTemplateDocumentFromModel(
  value: unknown = {},
): CommandFlowTemplateDocument {
  const model = plainObject(value)
    ? (value as Partial<CommandFlowTemplateModel>)
    : {};
  const document: CommandFlowTemplateDocument = {
    name: stringValue(model.name),
    stop_on_error: model.stopOnError !== false,
    steps: [],
  };
  if (model.hasDefaultMode || model.defaultMode !== null) {
    document.default_mode = model.defaultMode ?? "";
  }
  document.steps = Array.isArray(model.steps)
    ? model.steps.map(commandFlowStepDocumentFromModel)
    : [];
  return document;
}

export function commandFlowTemplateModelToToml(value: unknown = {}): string {
  return stringify(commandFlowTemplateDocumentFromModel(value));
}

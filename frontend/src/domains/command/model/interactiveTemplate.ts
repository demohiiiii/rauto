import { parse, stringify } from "smol-toml";
import type {
  InteractiveMultilineMode,
  InteractivePromptDocument,
  InteractiveCommandDocument,
  InteractiveTemplateDocument,
  InteractiveTemplateModel,
  InteractiveTemplatePromptModel,
  InteractiveCommandModel,
} from "./types.js";

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

function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string") throw new Error(`${path} must be a string`);
  return value;
}

function optionalBoolean(value: unknown, path: string): boolean {
  if (value === undefined) return false;
  if (typeof value !== "boolean") throw new Error(`${path} must be a boolean`);
  return value;
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
      throw new Error(`unsupported interactive command field: ${path}`);
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
): InteractiveMultilineMode {
  if (value == null || value === "") return "split_lines";
  if (value === "split_lines" || value === "whole") return value;
  throw new Error(`${path} must be split_lines or whole`);
}

export function defaultInteractiveTemplatePromptModel(): InteractiveTemplatePromptModel {
  return {
    patterns: [""],
    response: "",
    appendNewline: true,
    recordInput: false,
  };
}

export function defaultInteractiveCommandModel(): InteractiveCommandModel {
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

export function defaultInteractiveTemplateModel(): InteractiveTemplateModel {
  return {
    name: "interactive",
    ...defaultInteractiveCommandModel(),
  };
}

function interactivePromptModelFromDocument(
  prompt: unknown,
  promptIndex: number,
): InteractiveTemplatePromptModel {
  const source = assertPlainObject(prompt, `prompts[${promptIndex}]`);
  assertSupportedFields(source, PROMPT_FIELDS, `prompts[${promptIndex}]`);
  if (!Array.isArray(source.patterns)) {
    throw new Error(`prompts[${promptIndex}].patterns must be an array`);
  }
  return {
    patterns: source.patterns.map((pattern) =>
      requiredString(pattern, `prompts[${promptIndex}].patterns`),
    ),
    response: requiredString(
      source.response,
      `prompts[${promptIndex}].response`,
    ),
    appendNewline: optionalBoolean(
      source.append_newline,
      `prompts[${promptIndex}].append_newline`,
    ),
    recordInput: optionalBoolean(
      source.record_input,
      `prompts[${promptIndex}].record_input`,
    ),
  };
}

function interactiveCommandModelFromDocument(
  step: unknown,
): InteractiveCommandModel {
  const source = assertPlainObject(step, "interactive command");
  assertSupportedFields(source, STEP_FIELDS);
  const mode = optionalStringField(source, "mode");
  const hasTimeoutSecs = Object.hasOwn(source, "timeout_secs");
  const timeoutSecs = hasTimeoutSecs ? source.timeout_secs : null;
  if (
    timeoutSecs != null &&
    (!Number.isSafeInteger(timeoutSecs) || Number(timeoutSecs) < 0)
  ) {
    throw new Error(`timeout_secs must be a non-negative integer`);
  }
  if (source.prompts !== undefined && !Array.isArray(source.prompts)) {
    throw new Error("prompts must be an array");
  }
  const prompts = source.prompts ?? [];
  return {
    command: requiredString(source.command, "command"),
    multilineMode: multilineModeValue(source.multiline_mode, `multiline_mode`),
    mode: mode.value,
    hasMode: mode.present,
    timeoutSecs: timeoutSecs == null ? null : Number(timeoutSecs),
    hasTimeoutSecs,
    prompts: prompts.map((prompt, promptIndex) =>
      interactivePromptModelFromDocument(prompt, promptIndex),
    ),
  };
}

export function interactiveTemplateModelFromDocument(
  document: unknown = {},
): InteractiveTemplateModel {
  const source = {
    ...assertPlainObject(document, "interactive command template"),
  };
  assertSupportedFields(source, new Set(["name", ...STEP_FIELDS]));
  const { name, ...operation } = source;
  return {
    name: requiredString(name, "name"),
    ...interactiveCommandModelFromDocument(operation),
  };
}

export function interactiveTemplateModelFromToml(
  tomlText = "",
): InteractiveTemplateModel {
  return interactiveTemplateModelFromDocument(parse(stringValue(tomlText)));
}

export function normalizeLoadedInteractiveTemplateToml(tomlText = ""): string {
  const document = assertPlainObject(
    parse(stringValue(tomlText)),
    "interactive command template",
  );
  return interactiveTemplateModelToToml(
    interactiveTemplateModelFromDocument(document),
  );
}

function interactivePromptDocumentFromModel(
  prompt: InteractiveTemplatePromptModel,
): InteractivePromptDocument {
  return {
    patterns: prompt.patterns,
    response: prompt.response,
    append_newline: prompt.appendNewline,
    record_input: prompt.recordInput,
  };
}

function interactiveCommandDocumentFromModel(
  step: InteractiveCommandModel,
): InteractiveCommandDocument {
  const document: InteractiveCommandDocument = {
    command: step.command,
    multiline_mode: step.multilineMode,
    prompts: [],
  };
  if (step.hasMode || step.mode !== null) {
    document.mode = step.mode ?? "";
  }
  if (step.hasTimeoutSecs || step.timeoutSecs !== null) {
    document.timeout_secs = step.timeoutSecs ?? 0;
  }
  document.prompts = step.prompts.map(interactivePromptDocumentFromModel);
  return document;
}

export function interactiveTemplateDocumentFromModel(
  model: InteractiveTemplateModel,
): InteractiveTemplateDocument {
  return { name: model.name, ...interactiveCommandDocumentFromModel(model) };
}

export function interactiveTemplateModelToToml(
  model: InteractiveTemplateModel,
): string {
  return stringify(interactiveTemplateDocumentFromModel(model));
}

import { get, writable } from "svelte/store";
import { currentLanguage, tr } from "../../../lib/i18n.js";
import { safeString } from "../../../lib/ui.js";
import { templatesApi } from "../infrastructure/templatesApi.js";
import {
  listValue,
  recordValue,
  safeText,
} from "../model/templateResources.js";
import type {
  FlowTemplateSelectState,
  FlowVarField,
  FlowVarsState,
  UnknownRecord,
} from "../model/types.js";

const FLOW_TEMPLATE_BASE = "/api/flow-templates";
const FLOW_BUILTIN_TEMPLATE_BASE = "/api/flow-templates/builtins";
const FLOW_BUILTIN_PREFIX = "builtin:";

export const flowVarsFieldState = writable<FlowVarsState>({
  draft: {},
  errorMessage: "",
  fields: [],
  hintText: tr("flowVarsFieldsHint"),
  values: {},
});
export const runFlowTemplateSelectState = writable<FlowTemplateSelectState>({
  options: [],
  selected: "",
});

function defaultFlowVarDraft(field: FlowVarField): string {
  if (field.defaultValue === undefined || field.defaultValue === null)
    return "";
  if (field.kind === "boolean") {
    if (field.defaultValue === true) return "true";
    if (field.defaultValue === false) return "false";
    return "";
  }
  if (field.kind === "json") {
    try {
      return JSON.stringify(field.defaultValue, null, 2);
    } catch {
      return "";
    }
  }
  return safeString(field.defaultValue);
}

function flowVarsFieldValues(
  fields: FlowVarField[] = [],
  draft: UnknownRecord = {},
): UnknownRecord {
  return Object.fromEntries(
    fields.map((field) => {
      const draftValue = draft[field.name];
      const fieldValue =
        draftValue !== undefined
          ? safeString(draftValue ?? "")
          : defaultFlowVarDraft(field);
      return [field.name, fieldValue];
    }),
  );
}

async function fetchFlowTemplateCollections() {
  const [savedResult, builtinResult] = await Promise.allSettled([
    templatesApi.listTemplateResource(FLOW_TEMPLATE_BASE),
    templatesApi.listTemplateResource(FLOW_BUILTIN_TEMPLATE_BASE),
  ]);
  const metas =
    savedResult.status === "fulfilled" ? listValue(savedResult.value) : [];
  const builtinMetas =
    builtinResult.status === "fulfilled" ? listValue(builtinResult.value) : [];
  return {
    builtinMetas,
    metas,
    names: metas
      .map((meta) => recordValue(meta).name)
      .filter(Boolean) as string[],
  };
}

function buildBuiltinFlowTemplateValue(templateName: unknown): string {
  const normalized = safeString(templateName).trim();
  return normalized ? `${FLOW_BUILTIN_PREFIX}${normalized}` : "";
}

function updateFlowTemplateSelectOptions({
  builtinMetas = [],
  names = [],
}: {
  builtinMetas?: unknown[];
  names?: string[];
}): void {
  const builtinValues = builtinMetas
    .map((meta) => buildBuiltinFlowTemplateValue(recordValue(meta).name))
    .filter(Boolean);
  runFlowTemplateSelectState.update((state) => ({
    options: [...names, ...builtinValues],
    selected: safeString(state.selected || ""),
  }));
}

export async function loadFlowTemplates() {
  try {
    const flowTemplates = await fetchFlowTemplateCollections();
    updateFlowTemplateSelectOptions(flowTemplates);
    return flowTemplates;
  } catch (error) {
    updateFlowTemplateSelectOptions({ builtinMetas: [], names: [] });
    return {
      builtinMetas: [],
      error,
      metas: [],
      names: [],
    };
  }
}

let lastFlowRunTemplateDetailState: UnknownRecord | null = null;

export function parseBuiltinFlowTemplateValue(
  templateValue: unknown,
): string | null {
  const raw = safeString(templateValue).trim();
  if (!raw.toLowerCase().startsWith(FLOW_BUILTIN_PREFIX)) return null;
  const name = raw.slice(FLOW_BUILTIN_PREFIX.length).trim();
  return name || null;
}

function normalizeFlowTemplateVarSchema(value: unknown): FlowVarField | null {
  const item = recordValue(value);
  const name = safeString(item.name).trim();
  if (!name) return null;
  const kind = safeString(item.type || item.kind || "string")
    .trim()
    .toLowerCase();
  return {
    ...item,
    name,
    label: safeString(item.label || name).trim() || name,
    description: safeString(item.description).trim() || "",
    kind: kind || "string",
    required: !!item.required,
    allowEmpty: !!item.allow_empty,
    placeholder: safeString(item.placeholder).trim(),
    options: listValue(item.options).map(safeString).filter(Boolean),
    defaultValue:
      item.default !== undefined ? item.default : item.default_value,
  };
}

function getFlowRunVarsSchema(
  detail: UnknownRecord | null = lastFlowRunTemplateDetailState,
): FlowVarField[] {
  if (!detail || !Array.isArray(detail.vars_schema)) return [];
  return detail.vars_schema
    .map(normalizeFlowTemplateVarSchema)
    .filter((field): field is FlowVarField => field !== null);
}

export function updateFlowTemplateVarFields(
  detail: unknown = null,
  draft: unknown = {},
): void {
  if (detail !== undefined) {
    lastFlowRunTemplateDetailState =
      detail && typeof detail === "object" && !Array.isArray(detail)
        ? (detail as UnknownRecord)
        : null;
  }
  const schema = getFlowRunVarsSchema();
  const normalizedDraft = recordValue(draft);
  const hintText = !schema.length
    ? lastFlowRunTemplateDetailState
      ? tr("flowVarsFieldsEmpty")
      : tr("flowVarsFieldsHint")
    : tr("flowVarsFieldsHint");
  flowVarsFieldState.update((state) => ({
    ...state,
    draft: normalizedDraft,
    errorMessage: "",
    fields: schema,
    hintText,
    values: flowVarsFieldValues(schema, normalizedDraft),
  }));
}

function setFlowTemplateVarFieldsError(message: unknown): void {
  lastFlowRunTemplateDetailState = null;
  flowVarsFieldState.update((state) => ({
    ...state,
    draft: {},
    errorMessage: safeText(message),
    fields: [],
    hintText: tr("flowVarsFieldsHint"),
    values: {},
  }));
}

export function setFlowVarDraftValue(
  name: unknown,
  fieldValue: unknown = "",
): void {
  const key = safeString(name).trim();
  if (!key) return;
  flowVarsFieldState.update((state) => ({
    ...state,
    values: {
      ...state.values,
      [key]: safeString(fieldValue ?? ""),
    },
  }));
}

export async function ensureFlowRunTemplateDetail(
  templateName: unknown,
  loadConfig: { silent?: boolean } = {},
): Promise<UnknownRecord | null> {
  const name = safeString(templateName).trim();
  if (!name) {
    updateFlowTemplateVarFields(null, {});
    return null;
  }
  if (
    lastFlowRunTemplateDetailState &&
    safeString(lastFlowRunTemplateDetailState.__selection_key || "").trim() ===
      name
  ) {
    return lastFlowRunTemplateDetailState;
  }
  try {
    const builtinName = parseBuiltinFlowTemplateValue(name);
    const payload = await templatesApi.getTemplateResource(
      builtinName ? FLOW_BUILTIN_TEMPLATE_BASE : FLOW_TEMPLATE_BASE,
      builtinName || name,
    );
    payload.__selection_key = name;
    lastFlowRunTemplateDetailState = payload;
    updateFlowTemplateVarFields(payload, {});
    return payload;
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error
        ? error.message
        : String(error);
    if (!loadConfig.silent) setFlowTemplateVarFieldsError(message);
    else updateFlowTemplateVarFields(null, {});
    throw error;
  }
}

export function getCurrentFlowTemplateFieldDraft(): UnknownRecord {
  return recordValue(get(flowVarsFieldState).values);
}

function flowVarRequiredMessage(label: string): string {
  return currentLanguage() === "zh"
    ? `${label}${tr("flowVarRequiredSuffix")}`
    : `${label} ${tr("flowVarRequiredSuffix")}`;
}

function collectFlowTemplateFieldValues(): UnknownRecord {
  const fieldValues: UnknownRecord = {};
  const draft = getCurrentFlowTemplateFieldDraft();
  for (const field of getFlowRunVarsSchema()) {
    const hasDraft = Object.hasOwn(draft, field.name);
    const raw = safeString(hasDraft ? draft[field.name] : "");
    const isBlank = raw.trim() === "";
    const hasDefault = field.defaultValue != null;

    if (field.kind === "json") {
      if (isBlank) {
        if (field.required && !field.allowEmpty && !hasDefault) {
          throw new Error(flowVarRequiredMessage(field.label));
        }
        if (field.allowEmpty) fieldValues[field.name] = "";
        continue;
      }
      try {
        fieldValues[field.name] = JSON.parse(raw) as unknown;
      } catch {
        throw new Error(`${field.label} ${tr("flowVarJsonInvalid")}`);
      }
      continue;
    }

    if (field.kind === "boolean") {
      if (isBlank) {
        if (field.required && !field.allowEmpty && !hasDefault) {
          throw new Error(flowVarRequiredMessage(field.label));
        }
        if (field.allowEmpty) fieldValues[field.name] = "";
        continue;
      }
      fieldValues[field.name] = raw === "true";
      continue;
    }

    if (isBlank) {
      if (field.required && !field.allowEmpty && !hasDefault) {
        throw new Error(flowVarRequiredMessage(field.label));
      }
      if (field.allowEmpty) fieldValues[field.name] = "";
      continue;
    }

    if (field.kind === "number") {
      const parsed = Number(raw);
      if (Number.isNaN(parsed)) {
        throw new Error(`${field.label} ${tr("flowVarNumberInvalid")}`);
      }
      fieldValues[field.name] = parsed;
      continue;
    }

    fieldValues[field.name] = raw;
  }
  return fieldValues;
}

export function buildFlowVarsPayload(): UnknownRecord | null {
  const fieldVars = collectFlowTemplateFieldValues();
  return Object.keys(fieldVars).length ? fieldVars : null;
}

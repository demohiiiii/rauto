import { get, writable } from "svelte/store";
import { currentLanguage, tr } from "../../../lib/i18n.js";
import { safeString } from "../../../lib/ui.js";
import type { JsonObject, JsonValue } from "$lib/jsonValue.js";
import { templatesApi } from "../infrastructure/templatesApi.js";
import type {
  CommandFlowTemplateDetail,
  FlowTemplateSelectState,
  FlowVarField,
  FlowVarsState,
  TemplateResourceApiMeta,
  TemplateVariableField,
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
  draft: Record<string, string> = {},
): Record<string, string> {
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
  const metas = savedResult.status === "fulfilled" ? savedResult.value : [];
  const builtinMetas =
    builtinResult.status === "fulfilled" ? builtinResult.value : [];
  return {
    builtinMetas,
    metas,
    names: metas.map((meta) => meta.name).filter(Boolean),
  };
}

function buildBuiltinFlowTemplateValue(templateName: string): string {
  const normalized = templateName.trim();
  return normalized ? `${FLOW_BUILTIN_PREFIX}${normalized}` : "";
}

function updateFlowTemplateSelectOptions({
  builtinMetas = [],
  names = [],
}: {
  builtinMetas?: TemplateResourceApiMeta[];
  names?: string[];
}): void {
  const builtinValues = builtinMetas
    .map((meta) => buildBuiltinFlowTemplateValue(meta.name))
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

type FlowTemplateSchema = Pick<CommandFlowTemplateDetail, "vars_schema"> & {
  __selection_key?: string;
};

let lastFlowRunTemplateDetailState: FlowTemplateSchema | null = null;

export function parseBuiltinFlowTemplateValue(
  templateValue: string,
): string | null {
  const raw = templateValue.trim();
  if (!raw.toLowerCase().startsWith(FLOW_BUILTIN_PREFIX)) return null;
  const name = raw.slice(FLOW_BUILTIN_PREFIX.length).trim();
  return name || null;
}

function normalizeFlowTemplateVarSchema(
  field: TemplateVariableField,
): FlowVarField | null {
  const name = field.name.trim();
  if (!name) return null;
  const kind = field.type.trim().toLowerCase() || "string";
  return {
    name,
    label: field.label.trim() || name,
    description: field.description?.trim() ?? "",
    kind,
    required: field.required,
    allowEmpty: field.allow_empty,
    placeholder: field.placeholder?.trim() ?? "",
    options: field.options,
    defaultValue: field.default,
  };
}

function getFlowRunVarsSchema(
  detail: FlowTemplateSchema | null = lastFlowRunTemplateDetailState,
): FlowVarField[] {
  if (!detail) return [];
  return detail.vars_schema
    .map(normalizeFlowTemplateVarSchema)
    .filter((field): field is FlowVarField => field !== null);
}

export function updateFlowTemplateVarFields(
  detail: FlowTemplateSchema | null = null,
  draft: Record<string, string> = {},
): void {
  lastFlowRunTemplateDetailState = detail;
  const schema = getFlowRunVarsSchema();
  const hintText = !schema.length
    ? lastFlowRunTemplateDetailState
      ? tr("flowVarsFieldsEmpty")
      : tr("flowVarsFieldsHint")
    : tr("flowVarsFieldsHint");
  flowVarsFieldState.update((state) => ({
    ...state,
    draft,
    errorMessage: "",
    fields: schema,
    hintText,
    values: flowVarsFieldValues(schema, draft),
  }));
}

function setFlowTemplateVarFieldsError(message: unknown): void {
  lastFlowRunTemplateDetailState = null;
  flowVarsFieldState.update((state) => ({
    ...state,
    draft: {},
    errorMessage:
      message instanceof Error ? message.message : String(message ?? ""),
    fields: [],
    hintText: tr("flowVarsFieldsHint"),
    values: {},
  }));
}

export function setFlowVarDraftValue(name: string, fieldValue = ""): void {
  const key = name.trim();
  if (!key) return;
  flowVarsFieldState.update((state) => ({
    ...state,
    values: {
      ...state.values,
      [key]: fieldValue,
    },
  }));
}

export async function ensureFlowRunTemplateDetail(
  templateName: string,
  loadConfig: { silent?: boolean } = {},
): Promise<FlowTemplateSchema | null> {
  const name = templateName.trim();
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
    const payload = await templatesApi.getCommandFlowTemplate(
      builtinName || name,
      { builtin: Boolean(builtinName) },
    );
    const selectedDetail = { ...payload, __selection_key: name };
    updateFlowTemplateVarFields(selectedDetail, {});
    return selectedDetail;
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

export function getCurrentFlowTemplateFieldDraft(): Record<string, string> {
  return { ...get(flowVarsFieldState).values };
}

function flowVarRequiredMessage(label: string): string {
  return currentLanguage() === "zh"
    ? `${label}${tr("flowVarRequiredSuffix")}`
    : `${label} ${tr("flowVarRequiredSuffix")}`;
}

function collectFlowTemplateFieldValues(): JsonObject {
  const fieldValues: JsonObject = {};
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
        fieldValues[field.name] = JSON.parse(raw) as JsonValue;
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

export function buildFlowVarsPayload(): JsonObject | null {
  const fieldVars = collectFlowTemplateFieldValues();
  return Object.keys(fieldVars).length ? fieldVars : null;
}

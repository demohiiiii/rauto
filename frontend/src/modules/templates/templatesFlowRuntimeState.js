import { get as getStore, writable } from "svelte/store";
import { getTemplateResource, listTemplateResource } from "../../api/client.js";
import { currentLanguage, tr } from "../../lib/i18n.js";
import { safeString } from "../../lib/ui.js";

const FLOW_TEMPLATE_BASE = "/api/flow-templates";
const FLOW_BUILTIN_TEMPLATE_BASE = "/api/flow-templates/builtins";
const FLOW_BUILTIN_PREFIX = "builtin:";

export const flowVarsFieldState = writable({
  draft: {},
  errorMessage: "",
  fields: [],
  hintText: tr("flowVarsFieldsHint"),
  values: {},
});
export const runFlowTemplateSelectState = writable({
  options: [],
  selected: "",
});

function defaultFlowVarDraft(field) {
  if (
    !field ||
    field.defaultValue === undefined ||
    field.defaultValue === null
  ) {
    return "";
  }
  if (field.kind === "boolean") {
    if (field.defaultValue === true) return "true";
    if (field.defaultValue === false) return "false";
    return "";
  }
  if (field.kind === "json") {
    try {
      return JSON.stringify(field.defaultValue, null, 2);
    } catch (_) {
      return "";
    }
  }
  return safeString(field.defaultValue);
}

function flowVarsFieldValues(fields = [], draft = {}) {
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
    listTemplateResource(FLOW_TEMPLATE_BASE),
    listTemplateResource(FLOW_BUILTIN_TEMPLATE_BASE),
  ]);
  const metas =
    savedResult.status === "fulfilled" && Array.isArray(savedResult.value)
      ? savedResult.value
      : [];
  const builtinMetas =
    builtinResult.status === "fulfilled" && Array.isArray(builtinResult.value)
      ? builtinResult.value
      : [];
  return {
    builtinMetas,
    metas,
    names: metas
      .map((flowTemplateMeta) => flowTemplateMeta.name)
      .filter(Boolean),
  };
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

let lastFlowRunTemplateDetailState = null;

export function parseBuiltinFlowTemplateValue(templateValue) {
  const raw = safeString(templateValue).trim();
  if (!raw.toLowerCase().startsWith(FLOW_BUILTIN_PREFIX)) return null;
  const name = raw.slice(FLOW_BUILTIN_PREFIX.length).trim();
  return name || null;
}

function normalizeFlowTemplateVarSchema(flowVarSchemaItem) {
  if (!flowVarSchemaItem || !safeString(flowVarSchemaItem.name).trim()) {
    return null;
  }
  const kind = safeString(
    flowVarSchemaItem.type || flowVarSchemaItem.kind || "string",
  )
    .trim()
    .toLowerCase();
  return {
    name: safeString(flowVarSchemaItem.name).trim(),
    label:
      safeString(flowVarSchemaItem.label || flowVarSchemaItem.name).trim() ||
      safeString(flowVarSchemaItem.name).trim(),
    description: safeString(flowVarSchemaItem.description).trim() || "",
    kind: kind || "string",
    required: !!flowVarSchemaItem.required,
    allowEmpty: !!flowVarSchemaItem.allow_empty,
    placeholder: safeString(flowVarSchemaItem.placeholder).trim(),
    options: Array.isArray(flowVarSchemaItem.options)
      ? flowVarSchemaItem.options
          .map((optionValue) => safeString(optionValue))
          .filter(Boolean)
      : [],
    defaultValue:
      flowVarSchemaItem.default !== undefined
        ? flowVarSchemaItem.default
        : flowVarSchemaItem.default_value,
  };
}

function getFlowRunVarsSchema(detail = lastFlowRunTemplateDetailState) {
  if (!detail || !Array.isArray(detail.vars_schema)) return [];
  return detail.vars_schema.map(normalizeFlowTemplateVarSchema).filter(Boolean);
}

export function updateFlowTemplateVarFields(detail = null, draft = {}) {
  if (detail !== undefined) {
    lastFlowRunTemplateDetailState = detail;
  }
  const schema = getFlowRunVarsSchema();
  const normalizedDraft =
    draft && typeof draft === "object" && !Array.isArray(draft) ? draft : {};
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

function setFlowTemplateVarFieldsError(message) {
  lastFlowRunTemplateDetailState = null;
  flowVarsFieldState.update((state) => ({
    ...state,
    draft: {},
    errorMessage: message,
    fields: [],
    hintText: tr("flowVarsFieldsHint"),
    values: {},
  }));
}

export function setFlowVarDraftValue(name, fieldValue = "") {
  const key = safeString(name).trim();
  if (!key) return;
  flowVarsFieldState.update((state) => ({
    ...state,
    values: {
      ...(state.values || {}),
      [key]: safeString(fieldValue ?? ""),
    },
  }));
}

export async function ensureFlowRunTemplateDetail(templateName, loadCfg = {}) {
  const name = safeString(templateName).trim();
  if (!name) {
    updateFlowTemplateVarFields(null, {});
    return null;
  }
  const lastFlowRunTemplateDetail = lastFlowRunTemplateDetailState;
  if (
    lastFlowRunTemplateDetail &&
    safeString(lastFlowRunTemplateDetail.__selection_key || "").trim() === name
  ) {
    return lastFlowRunTemplateDetail;
  }
  try {
    const builtinName = parseBuiltinFlowTemplateValue(name);
    const flowRunTemplatePayload = await getTemplateResource(
      builtinName ? FLOW_BUILTIN_TEMPLATE_BASE : FLOW_TEMPLATE_BASE,
      builtinName || name,
    );
    if (flowRunTemplatePayload && typeof flowRunTemplatePayload === "object") {
      flowRunTemplatePayload.__selection_key = name;
    }
    lastFlowRunTemplateDetailState = flowRunTemplatePayload;
    updateFlowTemplateVarFields(flowRunTemplatePayload, {});
    return flowRunTemplatePayload;
  } catch (error) {
    if (!loadCfg.silent) {
      setFlowTemplateVarFieldsError(error.message);
    } else {
      updateFlowTemplateVarFields(null, {});
    }
    throw error;
  }
}

export function getCurrentFlowTemplateFieldDraft() {
  const draftValues = getStore(flowVarsFieldState).values;
  return draftValues &&
    typeof draftValues === "object" &&
    !Array.isArray(draftValues)
    ? draftValues
    : {};
}

function flowVarRequiredMessage(label) {
  return currentLanguage() === "zh"
    ? `${label}${tr("flowVarRequiredSuffix")}`
    : `${label} ${tr("flowVarRequiredSuffix")}`;
}

function collectFlowTemplateFieldValues() {
  const fieldValues = {};
  const draft = getCurrentFlowTemplateFieldDraft();
  for (const field of getFlowRunVarsSchema()) {
    const hasDraft = Object.prototype.hasOwnProperty.call(draft, field.name);
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
        fieldValues[field.name] = JSON.parse(raw);
      } catch (_) {
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

export function buildFlowVarsPayload() {
  const fieldVars = collectFlowTemplateFieldValues();
  return Object.keys(fieldVars).length ? fieldVars : null;
}

function buildBuiltinFlowTemplateValue(templateName) {
  const normalized = safeString(templateName).trim();
  return normalized ? `${FLOW_BUILTIN_PREFIX}${normalized}` : "";
}

function setRunFlowTemplateSelectState(selectState = {}) {
  runFlowTemplateSelectState.set({
    options: Array.isArray(selectState.options) ? selectState.options : [],
    selected: safeString(selectState.selected || ""),
  });
}

function getRunFlowTemplateSelectValue() {
  return safeString(getStore(runFlowTemplateSelectState).selected).trim();
}

function updateFlowTemplateSelectOptions({ builtinMetas = [], names = [] }) {
  const builtinValues = builtinMetas
    .map((templateMeta) => buildBuiltinFlowTemplateValue(templateMeta.name))
    .filter(Boolean);
  setRunFlowTemplateSelectState({
    options: [...names, ...builtinValues],
    selected: getRunFlowTemplateSelectValue(),
  });
}

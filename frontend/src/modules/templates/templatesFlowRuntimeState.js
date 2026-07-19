import { get as getStore, writable } from "svelte/store";
import {
  createTemplateResource,
  deleteTemplateResource,
  getTemplateResource,
  listTemplateResource,
  updateTemplateResource,
} from "../../api/client.js";
import { currentLanguage, tr } from "../../lib/i18n.js";
import {
  promptForResourceName,
  safeString,
  statusPresentation,
} from "../../lib/ui.js";
import { showToast } from "../overlays/overlays.js";

const callHook = (hooks, hookName, ...args) =>
  typeof hooks[hookName] === "function" ? hooks[hookName](...args) : undefined;

const FLOW_TEMPLATE_BASE = "/api/flow-templates";
const FLOW_BUILTIN_TEMPLATE_BASE = "/api/flow-templates/builtins";
const FLOW_BUILTIN_PREFIX = "builtin:";

export const builtinFlowTemplateContentText = writable("");
export const builtinFlowTemplateListState = writable({
  builtinFlowTemplates: [],
  errorMessage: "",
  selectedName: "",
});
export const builtinFlowTemplateNames = writable([]);
export const builtinFlowTemplateSelectedName = writable("");
export const flowTemplateStatusState = writable({
  message: "",
  tone: "info",
});
export const flowTemplateContentText = writable("");
export const flowVarsFieldState = writable({
  draft: {},
  errorMessage: "",
  fields: [],
  hintText: tr("flowVarsFieldsHint"),
  values: {},
});
export const flowTemplateListState = writable({
  errorMessage: "",
  flowTemplateMetas: [],
  selectedName: "",
});
export const flowTemplateNames = writable([]);
export const flowTemplateSelectedName = writable("");
export const runFlowTemplateSelectState = writable({
  options: [],
  selected: "",
});

function setFlowStatus(message, tone = "info") {
  const presentation = statusPresentation(message, tone);
  flowTemplateStatusState.set({
    message: presentation.inlineMessage,
    tone: presentation.tone,
  });
  if (presentation.shouldToast) {
    showToast(presentation.text, presentation.tone);
  }
}

function namedStatusMessage(key, fallback, name) {
  return `${tr(key, fallback)}: ${name}`;
}

function setNamedFlowStatus(key, fallback, name, tone = "success") {
  setFlowStatus(namedStatusMessage(key, fallback, name), tone);
}

function setRunningFlowStatus() {
  setFlowStatus(tr("running", "running"), "running");
}

function setFlowErrorStatus(error) {
  setFlowStatus(error?.message || String(error || ""), "error");
}

function selectedFromOptions(optionValues, selected) {
  const picked = safeString(selected || "");
  return !picked || optionValues.includes(picked) ? picked : "";
}

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

export function getLastFlowRunTemplateDetail() {
  return lastFlowRunTemplateDetailState;
}

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

function setFlowTemplatePickerState(pickerState) {
  const names = Array.isArray(pickerState?.names) ? pickerState.names : [];
  const selected = safeString(pickerState?.selected || "");
  flowTemplateNames.set(names);
  flowTemplateSelectedName.set(selectedFromOptions(names, selected));
}

function setFlowTemplateSelected(templateName = "") {
  flowTemplateSelectedName.set(safeString(templateName || ""));
}

export function setFlowTemplatePickerValue(templateName = "") {
  setFlowTemplateSelected(templateName);
}

function getFlowTemplatePickerValue() {
  return safeString(getStore(flowTemplateSelectedName)).trim();
}

function setRunFlowTemplateSelectState(selectState) {
  runFlowTemplateSelectState.set({
    options: Array.isArray(selectState?.options) ? selectState.options : [],
    selected: safeString(selectState?.selected || ""),
  });
}

export function setRunFlowTemplateSelectValue(templateName = "") {
  runFlowTemplateSelectState.update((state) => ({
    ...state,
    selected: safeString(templateName).trim(),
  }));
}

function getRunFlowTemplateSelectValue() {
  return safeString(getStore(runFlowTemplateSelectState).selected).trim();
}

function setFlowTemplateListState(listStateInput = {}) {
  flowTemplateListState.set({
    errorMessage: safeString(listStateInput.errorMessage || ""),
    flowTemplateMetas: Array.isArray(listStateInput.flowTemplateMetas)
      ? listStateInput.flowTemplateMetas
      : [],
    selectedName: safeString(listStateInput.selectedName || ""),
  });
}

function getFlowTemplateContentValue() {
  return safeString(getStore(flowTemplateContentText));
}

function setFlowTemplateContentValue(templateContent = "") {
  flowTemplateContentText.set(safeString(templateContent));
}

export function setFlowTemplateContent(templateContent = "") {
  setFlowTemplateContentValue(templateContent);
}

function setBuiltinFlowTemplatePickerState(pickerState) {
  const names = Array.isArray(pickerState?.names) ? pickerState.names : [];
  const selected = safeString(pickerState?.selected || "");
  builtinFlowTemplateNames.set(names);
  builtinFlowTemplateSelectedName.set(selectedFromOptions(names, selected));
}

function setBuiltinFlowTemplateSelected(templateName = "") {
  builtinFlowTemplateSelectedName.set(safeString(templateName || ""));
}

export function setBuiltinFlowTemplatePickerValue(templateName = "") {
  setBuiltinFlowTemplateSelected(templateName);
}

function getBuiltinFlowTemplatePickerValue() {
  return safeString(getStore(builtinFlowTemplateSelectedName)).trim();
}

function setBuiltinFlowTemplateListState(listStateInput = {}) {
  builtinFlowTemplateListState.set({
    builtinFlowTemplates: Array.isArray(listStateInput.builtinFlowTemplates)
      ? listStateInput.builtinFlowTemplates
      : [],
    errorMessage: safeString(listStateInput.errorMessage || ""),
    selectedName: safeString(listStateInput.selectedName || ""),
  });
}

function setBuiltinFlowTemplateContentValue(templateContent = "") {
  builtinFlowTemplateContentText.set(safeString(templateContent));
}

function buildBuiltinFlowTemplateValue(builtinFlowTemplateName) {
  const normalized = safeString(builtinFlowTemplateName).trim();
  return normalized ? `${FLOW_BUILTIN_PREFIX}${normalized}` : "";
}

function updateFlowTemplateListState({
  errorMessage = "",
  metas = [],
  selectedName = "",
}) {
  setFlowTemplateListState({
    errorMessage,
    flowTemplateMetas: Array.isArray(metas) ? metas : [],
    selectedName,
  });
}

function updateBuiltinFlowTemplateListState({
  errorMessage = "",
  metas = [],
  selectedName = "",
}) {
  setBuiltinFlowTemplateListState({
    builtinFlowTemplates: Array.isArray(metas) ? metas : [],
    errorMessage,
    selectedName,
  });
}

function updateFlowTemplateSelectOptions({ builtinMetas = [], names = [] }) {
  const builtinRunValues = builtinMetas
    .map((builtinTemplateMeta) =>
      buildBuiltinFlowTemplateValue(builtinTemplateMeta.name),
    )
    .filter(Boolean);
  const runTemplateValues = [...names, ...builtinRunValues];

  setFlowTemplatePickerState({
    names,
    selected: getFlowTemplatePickerValue(),
  });
  const builtinNames = builtinMetas
    .map((builtinTemplateMeta) => builtinTemplateMeta.name)
    .filter(Boolean);
  setBuiltinFlowTemplatePickerState({
    names: builtinNames,
    selected: getBuiltinFlowTemplatePickerValue(),
  });
  setRunFlowTemplateSelectState({
    options: runTemplateValues,
    selected: getRunFlowTemplateSelectValue(),
  });
}

function createFlowTemplateSectionState() {
  return {
    builtinMetas: [],
    metas: [],
    names: [],
  };
}

function updateFlowTemplateSectionState(flowSection, metas, builtinMetas) {
  flowSection.metas = Array.isArray(metas) ? metas : [];
  flowSection.names = flowSection.metas
    .map((flowTemplateMeta) => flowTemplateMeta.name)
    .filter(Boolean);
  flowSection.builtinMetas = Array.isArray(builtinMetas) ? builtinMetas : [];
}

function resetFlowTemplateSectionState(flowSection) {
  updateFlowTemplateSectionState(flowSection, [], []);
}

function createCustomFlowTemplateState(hooks = {}) {
  let lastFlowTemplateDetail = null;

  function setLastDetail(detail) {
    lastFlowTemplateDetail = detail;
    callHook(hooks, "onDetailChange", detail);
  }

  return {
    getLastDetail() {
      return lastFlowTemplateDetail;
    },
    setLastDetail,
  };
}

function updateFlowTemplateVarsIfSelected(flowTemplateName, detail) {
  const currentSelection = getRunFlowTemplateSelectValue();
  if (currentSelection.trim() !== safeString(flowTemplateName).trim()) return;
  updateFlowTemplateVarFields(detail, getCurrentFlowTemplateFieldDraft());
}

function flowTemplateNameRequiredMessage() {
  return tr(
    "flowTemplateNameRequired",
    "command flow template name is required",
  );
}

function defaultFlowTemplateDraft(flowTemplateName) {
  return `name = "${flowTemplateName}"
description = ""
stop_on_error = true
default_mode = "User"

[[steps]]
command = "echo hello"
`;
}

function applyFlowTemplateDetail({
  detail,
  fallbackContent,
  hooks,
  flowTemplates,
}) {
  const flowTemplateNameValue = detail.name || getFlowTemplatePickerValue();
  setFlowTemplatePickerValue(flowTemplateNameValue);
  setFlowTemplateContentValue(detail.content || fallbackContent || "");
  flowTemplates.setLastDetail(detail);
  updateFlowTemplateVarsIfSelected(flowTemplateNameValue, detail);
  callHook(hooks, "refreshList");
  return flowTemplateNameValue;
}

function clearFlowTemplateDetail({ hooks, flowTemplates }) {
  setFlowTemplateContentValue("");
  flowTemplates.setLastDetail(null);
  callHook(hooks, "refreshList");
}

async function loadSelectedFlowTemplateDetail(flowTemplates, hooks = {}) {
  const flowTemplateNameValue = getFlowTemplatePickerValue();
  if (!flowTemplateNameValue) {
    setFlowStatus(flowTemplateNameRequiredMessage(), "error");
    return;
  }
  setRunningFlowStatus();
  try {
    const flowTemplatePayload = await getTemplateResource(
      FLOW_TEMPLATE_BASE,
      flowTemplateNameValue,
    );
    const loadedName = applyFlowTemplateDetail({
      detail: flowTemplatePayload,
      flowTemplates,
      hooks,
    });
    setNamedFlowStatus("loaded", "Loaded", loadedName);
  } catch (error) {
    flowTemplates.setLastDetail(null);
    setFlowErrorStatus(error);
  }
}

async function createFlowTemplateDraft(flowTemplates, hooks = {}) {
  const flowTemplateNamePrompt = tr(
    "flowTemplateNewPrompt",
    "New command flow template name",
  );
  const flowTemplateName = promptForResourceName(flowTemplateNamePrompt);
  if (!flowTemplateName) return;
  const content = getFlowTemplateContentValue();
  const fallbackDraft = defaultFlowTemplateDraft(flowTemplateName);
  const draftContent = content.trim() ? content : fallbackDraft;
  setRunningFlowStatus();
  try {
    const createdFlowTemplatePayload = await createTemplateResource(
      FLOW_TEMPLATE_BASE,
      flowTemplateName,
      draftContent,
    );
    await callHook(hooks, "loadAll");
    const createdName = applyFlowTemplateDetail({
      detail: createdFlowTemplatePayload,
      fallbackContent: draftContent,
      flowTemplates,
      hooks,
    });
    setNamedFlowStatus("created", "Created", createdName);
  } catch (error) {
    setFlowTemplatePickerValue(flowTemplateName);
    setFlowTemplateContentValue(draftContent);
    flowTemplates.setLastDetail(null);
    callHook(hooks, "refreshList");
    setFlowErrorStatus(error);
  }
}

async function saveCurrentFlowTemplate(flowTemplates, hooks = {}) {
  const name = getFlowTemplatePickerValue();
  const content = getFlowTemplateContentValue();
  if (!name) {
    setFlowStatus(flowTemplateNameRequiredMessage(), "error");
    return;
  }
  setRunningFlowStatus();
  try {
    const exists = (callHook(hooks, "getNames") || []).includes(name);
    const savedFlowTemplatePayload = exists
      ? await updateTemplateResource(FLOW_TEMPLATE_BASE, name, content)
      : await createTemplateResource(FLOW_TEMPLATE_BASE, name, content);
    setFlowStatus(
      `${exists ? tr("saved", "Saved") : tr("created", "Created")}: ${savedFlowTemplatePayload.name || name}`,
      "success",
    );
    await callHook(hooks, "loadAll");
    applyFlowTemplateDetail({
      detail: savedFlowTemplatePayload,
      fallbackContent: content,
      flowTemplates,
      hooks,
    });
  } catch (error) {
    setFlowErrorStatus(error);
  }
}

async function deleteCurrentFlowTemplate(flowTemplates, hooks = {}) {
  const name = getFlowTemplatePickerValue();
  if (!name) {
    setFlowStatus(flowTemplateNameRequiredMessage(), "error");
    return;
  }
  setRunningFlowStatus();
  try {
    await deleteTemplateResource(FLOW_TEMPLATE_BASE, name);
    setNamedFlowStatus("deleted", "Deleted", name);
    await callHook(hooks, "loadAll");
    if (getFlowTemplatePickerValue() === name) setFlowTemplatePickerValue("");
    const runTemplateSelection = getRunFlowTemplateSelectValue();
    if (runTemplateSelection === name) updateFlowTemplateVarFields(null, {});
    clearFlowTemplateDetail({ hooks, flowTemplates });
  } catch (error) {
    setFlowErrorStatus(error);
  }
}

async function selectFlowTemplateName(
  flowTemplates,
  hooks = {},
  flowTemplateName,
) {
  if (!flowTemplateName) return;
  setFlowTemplatePickerValue(flowTemplateName);
  callHook(hooks, "refreshList");
  await loadSelectedFlowTemplateDetail(flowTemplates, hooks);
  callHook(hooks, "refreshList");
}

async function applyFlowTemplatePickerChange(flowTemplates, hooks = {}) {
  if (!getFlowTemplatePickerValue()) return;
  await loadSelectedFlowTemplateDetail(flowTemplates, hooks);
  callHook(hooks, "refreshList");
}

function createCustomFlowTemplateSectionWorkspace(hooks = {}) {
  const flowTemplates = createCustomFlowTemplateState(hooks);

  return {
    createFlowTemplateDraft: () =>
      createFlowTemplateDraft(flowTemplates, hooks),
    deleteFlowTemplate: () => deleteCurrentFlowTemplate(flowTemplates, hooks),
    getLastDetail: flowTemplates.getLastDetail,
    loadFlowTemplateDetail: () =>
      loadSelectedFlowTemplateDetail(flowTemplates, hooks),
    onFlowTemplatePickerChange: () =>
      applyFlowTemplatePickerChange(flowTemplates, hooks),
    saveFlowTemplate: () => saveCurrentFlowTemplate(flowTemplates, hooks),
    selectFlowTemplateName: (flowTemplateName) =>
      selectFlowTemplateName(flowTemplates, hooks, flowTemplateName),
    setDraftDetail: flowTemplates.setLastDetail,
  };
}

function createBuiltinFlowTemplateSectionWorkspace(hooks = {}) {
  let lastBuiltinFlowTemplateDetail = null;

  function setLastDetail(detail) {
    lastBuiltinFlowTemplateDetail = detail;
    callHook(hooks, "onBuiltinDetailChange", detail);
  }

  function clearBuiltinContent() {
    setBuiltinFlowTemplateContentValue("");
  }

  function clearDetail() {
    setLastDetail(null);
    clearBuiltinContent();
  }

  async function loadBuiltinFlowTemplateDetail(nameOverride = "") {
    const name = safeString(
      nameOverride || getBuiltinFlowTemplatePickerValue() || "",
    ).trim();
    if (!name) {
      clearDetail();
      setFlowStatus("-", "info");
      callHook(hooks, "refreshBuiltinList");
      return null;
    }
    setRunningFlowStatus();
    try {
      const builtinFlowTemplatePayload = await getTemplateResource(
        FLOW_BUILTIN_TEMPLATE_BASE,
        name,
      );
      setLastDetail(builtinFlowTemplatePayload);
      setBuiltinFlowTemplatePickerValue(
        builtinFlowTemplatePayload.name || name,
      );
      setBuiltinFlowTemplateContentValue(
        builtinFlowTemplatePayload.content || "",
      );
      callHook(hooks, "refreshBuiltinList");
      setNamedFlowStatus(
        "loaded",
        "Loaded",
        builtinFlowTemplatePayload.name || name,
      );
      return builtinFlowTemplatePayload;
    } catch (error) {
      clearDetail();
      callHook(hooks, "refreshBuiltinList");
      setFlowErrorStatus(error);
      return null;
    }
  }

  async function copyBuiltinFlowTemplateToCustom() {
    const selectedName = getBuiltinFlowTemplatePickerValue();
    if (!selectedName) {
      setFlowStatus(
        tr(
          "flowBuiltinTemplateNameRequired",
          "built-in command flow template is required",
        ),
        "error",
      );
      return;
    }
    let detail = lastBuiltinFlowTemplateDetail;
    if (!detail || safeString(detail.name).trim() !== selectedName) {
      detail = await loadBuiltinFlowTemplateDetail(selectedName);
    }
    if (!detail) {
      setFlowStatus(
        tr("needLoadBuiltinFirst", "load built-in template first"),
        "error",
      );
      return;
    }
    const targetName = promptForResourceName(
      tr("flowBuiltinTemplateCopyPrompt", "Copy as custom template name"),
      `${detail.name}_custom`,
    );
    if (!targetName) return;
    setFlowTemplatePickerValue(targetName);
    setFlowTemplateContentValue(detail.content || "");
    callHook(hooks, "onCopyToCustom", {
      ...detail,
      name: targetName,
    });
    callHook(hooks, "refreshFlowList");
    setFlowStatus(
      `${tr("flowBuiltinTemplateCopied", "Copied")}: ${detail.name} -> ${targetName}`,
      "success",
    );
  }

  async function selectBuiltinFlowTemplateName(builtinFlowTemplateName) {
    if (!builtinFlowTemplateName) return;
    setBuiltinFlowTemplatePickerValue(builtinFlowTemplateName);
    callHook(hooks, "refreshBuiltinList");
    await loadBuiltinFlowTemplateDetail(builtinFlowTemplateName);
    callHook(hooks, "refreshBuiltinList");
  }

  async function refreshSelectedBuiltinFlowTemplate() {
    if (!getBuiltinFlowTemplatePickerValue()) {
      clearDetail();
      callHook(hooks, "refreshBuiltinList");
      return;
    }
    await loadBuiltinFlowTemplateDetail();
    callHook(hooks, "refreshBuiltinList");
  }

  return {
    clearDetail,
    copyBuiltinFlowTemplateToCustom,
    getLastDetail() {
      return lastBuiltinFlowTemplateDetail;
    },
    loadBuiltinFlowTemplateDetail,
    loadDetail: loadBuiltinFlowTemplateDetail,
    refreshSelectedBuiltinFlowTemplate,
    selectBuiltinFlowTemplateName,
  };
}

export function createFlowTemplateSectionWorkspace() {
  const flowSection = createFlowTemplateSectionState();
  let customFlowTemplateSection = null;
  let builtinFlowTemplateSection = null;

  function refreshFlowTemplateListState(errorMessage = "") {
    updateFlowTemplateListState({
      errorMessage,
      metas: flowSection.metas,
      selectedName: getFlowTemplatePickerValue(),
    });
  }

  function refreshBuiltinFlowTemplateListState(errorMessage = "") {
    updateBuiltinFlowTemplateListState({
      errorMessage,
      metas: flowSection.builtinMetas,
      selectedName: getBuiltinFlowTemplatePickerValue(),
    });
  }

  function refreshFlowTemplateOptions() {
    updateFlowTemplateSelectOptions({
      builtinMetas: flowSection.builtinMetas,
      names: flowSection.names,
    });
  }

  async function loadTemplates() {
    try {
      const { builtinMetas, metas } = await fetchFlowTemplateCollections();
      updateFlowTemplateSectionState(flowSection, metas, builtinMetas);
      refreshFlowTemplateOptions();
      refreshFlowTemplateListState();
      refreshBuiltinFlowTemplateListState();
    } catch (error) {
      resetFlowTemplateSectionState(flowSection);
      builtinFlowTemplateSection.clearDetail();
      refreshFlowTemplateOptions();
      refreshFlowTemplateListState(error.message);
      refreshBuiltinFlowTemplateListState(error.message);
    }
  }

  customFlowTemplateSection = createCustomFlowTemplateSectionWorkspace({
    getNames: () => flowSection.names,
    loadAll: loadTemplates,
    refreshList: refreshFlowTemplateListState,
  });
  builtinFlowTemplateSection = createBuiltinFlowTemplateSectionWorkspace({
    onCopyToCustom: (detail) =>
      customFlowTemplateSection.setDraftDetail(detail),
    refreshBuiltinList: refreshBuiltinFlowTemplateListState,
    refreshFlowList: refreshFlowTemplateListState,
  });

  function init() {
    refreshFlowTemplateListState();
    refreshBuiltinFlowTemplateListState();
  }

  return {
    copyBuiltinFlowTemplateToCustom:
      builtinFlowTemplateSection.copyBuiltinFlowTemplateToCustom,
    createFlowTemplateDraft: customFlowTemplateSection.createFlowTemplateDraft,
    deleteFlowTemplate: customFlowTemplateSection.deleteFlowTemplate,
    init,
    load: loadTemplates,
    loadBuiltinFlowTemplateDetail:
      builtinFlowTemplateSection.loadBuiltinFlowTemplateDetail,
    loadFlowTemplates: loadTemplates,
    onFlowTemplatePickerChange:
      customFlowTemplateSection.onFlowTemplatePickerChange,
    refreshBuiltinList: refreshBuiltinFlowTemplateListState,
    refreshList: refreshFlowTemplateListState,
    refreshOptions: refreshFlowTemplateOptions,
    refreshSelectedBuiltinFlowTemplate:
      builtinFlowTemplateSection.refreshSelectedBuiltinFlowTemplate,
    saveFlowTemplate: customFlowTemplateSection.saveFlowTemplate,
    selectBuiltinFlowTemplateName:
      builtinFlowTemplateSection.selectBuiltinFlowTemplateName,
    selectFlowTemplateName: customFlowTemplateSection.selectFlowTemplateName,
  };
}

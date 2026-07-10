import { tr } from "../lib/i18n.js";
import { safeString, statusPresentation } from "../lib/ui.js";

function templateEditorContent(contentText = "") {
  return safeString(contentText || "");
}

function templatePanelStatusDisplay(statusState = {}) {
  return statusPresentation(
    statusState.message || "",
    statusState.tone || "info",
    {
      suppressPassiveLoaded: false,
    },
  );
}

function templateEditorPanelDisplay({
  contentText = "",
  names = [],
  selectedName = "",
  statusState = {},
  titleKey = "",
  titleFallback = "",
} = {}) {
  const status = templatePanelStatusDisplay(statusState);
  return {
    contentText: templateEditorContent(contentText),
    names: Array.isArray(names) ? names : [],
    selectedName: safeString(selectedName || ""),
    showStatus: !!status.text,
    status,
    title: tr(titleKey, titleFallback),
  };
}

export function customFlowTemplatePanelDisplay({
  contentText = "",
  listState = {},
  names = [],
  selectedName = "",
  statusState = {},
} = {}) {
  const display = templateEditorPanelDisplay({
    contentText,
    names,
    selectedName,
    statusState,
    titleKey: "customFlowTemplatesTitle",
    titleFallback: "Custom Flow Templates",
  });
  return {
    ...display,
    errorMessage: safeString(listState.errorMessage || ""),
  };
}

function builtinFlowTemplateListPresentation() {
  return {
    emptyMessage: tr("builtinFlowTemplatesEmpty"),
    title: tr("builtinFlowTemplatesTitle"),
  };
}

export function builtinFlowTemplatePanelDisplay({
  contentText = "",
  listState = {},
} = {}) {
  const listPresentation = builtinFlowTemplateListPresentation();
  return {
    contentText: templateEditorContent(contentText),
    emptyMessage: listPresentation.emptyMessage,
    errorMessage: safeString(listState.errorMessage || ""),
    selectedName: safeString(listState.selectedName || ""),
    title: listPresentation.title,
  };
}

function flowVarAllowsEmpty(typeValue = "") {
  return typeValue === "null" || typeValue === "json";
}

function flowVarInputType(typeValue = "") {
  return typeValue === "number" ? "number" : "text";
}

function flowVarHasOptions(optionValues = []) {
  return Array.isArray(optionValues) && optionValues.length > 0;
}

function flowVarTypeLabel(typeValue = "") {
  return tr(
    `flowVarType${safeString(typeValue).replace(/^./u, (matchText) =>
      matchText.toUpperCase(),
    )}`,
    typeValue,
  );
}

function flowVarRow(fieldName, fieldDraft = {}) {
  const typeValue = safeString(fieldDraft.type || "string");
  const optionValues = Array.isArray(fieldDraft.options)
    ? fieldDraft.options
    : [];
  return {
    allowsEmpty: flowVarAllowsEmpty(typeValue),
    currentValue: fieldDraft.value ?? "",
    fieldName: safeString(fieldName),
    hasOptions: flowVarHasOptions(optionValues),
    inputType: flowVarInputType(typeValue),
    optionValues,
    placeholder: safeString(fieldDraft.placeholder || ""),
    required: !!fieldDraft.required,
    typeLabel: flowVarTypeLabel(typeValue),
    typeValue,
  };
}

export function flowVarsPresentation(flowVarsState = {}) {
  const draft = flowVarsState.draft || {};
  const fieldNames = Array.isArray(flowVarsState.fieldNames)
    ? flowVarsState.fieldNames
    : [];
  const rows = fieldNames.map((fieldName) =>
    flowVarRow(fieldName, draft[fieldName] || {}),
  );
  return {
    emptyMessage: tr("flowVarsEmpty"),
    rows,
  };
}

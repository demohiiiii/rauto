import { tr } from "../../lib/i18n.js";
import { safeString, statusPresentation } from "../../lib/ui.js";

function flowVarAllowsEmpty(field = {}) {
  return !!field.allowEmpty || field.kind === "null";
}

function flowVarInputType(typeValue = "") {
  if (typeValue === "secret") return "password";
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

function flowVarControlKind(typeValue = "", optionValues = []) {
  if (flowVarHasOptions(optionValues)) return "options-select";
  if (typeValue === "boolean") return "boolean-select";
  if (typeValue === "json") return "json-editor";
  return "input";
}

function flowVarRow(field = {}, value = "") {
  const fieldName = safeString(field.name);
  const typeValue = safeString(field.kind || "string");
  const optionValues = Array.isArray(field.options) ? field.options : [];
  const required = !!field.required;
  return {
    allowsEmpty: flowVarAllowsEmpty(field),
    booleanValueOptions: ["true", "false"],
    controlKind: flowVarControlKind(typeValue, optionValues),
    descriptionText: safeString(field.description),
    fieldName,
    hasOptions: flowVarHasOptions(optionValues),
    hasDescription: !!safeString(field.description),
    inputAriaLabel: safeString(field.label || fieldName),
    inputContainerClass: "mt-2",
    inputType: flowVarInputType(typeValue),
    labelText: safeString(field.label || fieldName),
    optionValues,
    placeholderText: safeString(field.placeholder),
    required,
    requirementBadgeClass: required
      ? "inline-flex items-center rounded-md bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive"
      : "inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground",
    requirementLabelText: tr(
      required ? "flowVarRequiredLabel" : "flowVarOptionalLabel",
    ),
    typeBadgeText: flowVarTypeLabel(typeValue),
    typeValue,
    value,
  };
}

export function flowVarsPresentation(flowVarsState = {}) {
  const fields = Array.isArray(flowVarsState.fields)
    ? flowVarsState.fields
    : [];
  const values =
    flowVarsState.values && typeof flowVarsState.values === "object"
      ? flowVarsState.values
      : {};
  const fieldRows = fields.map((field) =>
    flowVarRow(field, values[field.name] ?? ""),
  );
  const errorMessage = safeString(flowVarsState.errorMessage);
  return {
    countMetaText: String(fieldRows.length),
    emptyText: tr("flowVarsFieldsEmpty"),
    errorMessage,
    errorStatus: statusPresentation(errorMessage, "error"),
    fieldRows,
    hasFields: fieldRows.length > 0,
    hintText: safeString(flowVarsState.hintText),
    titleText: tr("flowVarsFieldsTitle"),
  };
}

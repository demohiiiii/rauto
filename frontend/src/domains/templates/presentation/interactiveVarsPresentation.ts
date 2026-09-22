import { tr } from "../../../lib/i18n.js";
import {
  displayString,
  safeString,
  statusPresentation,
} from "../../../lib/ui.js";
import type {
  InteractiveVarControlKind,
  InteractiveVarField,
  InteractiveVarFieldRow,
  InteractiveVarsPresentation,
  InteractiveVarsState,
} from "../model/types.js";

function interactiveVarAllowsEmpty(
  field: Partial<InteractiveVarField>,
): boolean {
  return !!field.allowEmpty || field.kind === "null";
}

function interactiveVarInputType(
  typeValue = "",
): "number" | "password" | "text" {
  if (typeValue === "secret") return "password";
  return typeValue === "number" ? "number" : "text";
}

function interactiveVarHasOptions(optionValues: readonly string[]): boolean {
  return optionValues.length > 0;
}

function interactiveVarTypeLabel(typeValue = ""): string {
  return tr(
    `interactiveVarType${safeString(typeValue).replace(/^./u, (text) =>
      text.toUpperCase(),
    )}`,
    typeValue,
  );
}

function interactiveVarControlKind(
  typeValue = "",
  optionValues: readonly string[],
): InteractiveVarControlKind {
  if (interactiveVarHasOptions(optionValues)) return "options-select";
  if (typeValue === "boolean") return "boolean-select";
  if (typeValue === "json") return "json-editor";
  return "input";
}

function interactiveVarRow(
  field: InteractiveVarField,
  value: InteractiveVarsState["values"][string] = "",
): InteractiveVarFieldRow {
  const fieldName = safeString(field.name);
  const typeValue = safeString(field.kind || "string");
  const optionValues = Array.isArray(field.options) ? field.options : [];
  const required = !!field.required;
  return {
    allowsEmpty: interactiveVarAllowsEmpty(field),
    booleanValueOptions: ["true", "false"],
    controlKind: interactiveVarControlKind(typeValue, optionValues),
    descriptionText: safeString(field.description),
    fieldName,
    hasOptions: interactiveVarHasOptions(optionValues),
    hasDescription: !!safeString(field.description),
    inputAriaLabel: safeString(field.label || fieldName),
    inputContainerClass: "mt-2",
    inputType: interactiveVarInputType(typeValue),
    labelText: safeString(field.label || fieldName),
    optionValues,
    placeholderText: safeString(field.placeholder),
    required,
    requirementBadgeClass: required
      ? "inline-flex items-center rounded-md bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive"
      : "inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground",
    requirementLabelText: tr(
      required ? "interactiveVarRequiredLabel" : "interactiveVarOptionalLabel",
    ),
    typeBadgeText: interactiveVarTypeLabel(typeValue),
    typeValue,
    value: displayString(value),
  };
}

export function interactiveVarsPresentation(
  interactiveVarsState: Partial<InteractiveVarsState> = {},
): InteractiveVarsPresentation {
  const fields = interactiveVarsState.fields ?? [];
  const values = interactiveVarsState.values ?? {};
  const fieldRows = fields.map((field) =>
    interactiveVarRow(field, values[field.name] ?? ""),
  );
  const errorMessage = safeString(interactiveVarsState.errorMessage);
  return {
    countMetaText: String(fieldRows.length),
    emptyText: tr("interactiveVarsFieldsEmpty"),
    errorMessage,
    errorStatus: {
      ...statusPresentation(errorMessage, "error"),
      tone: "error",
    },
    fieldRows,
    hasFields: fieldRows.length > 0,
    hintText: safeString(interactiveVarsState.hintText),
    titleText: tr("interactiveVarsFieldsTitle"),
  };
}

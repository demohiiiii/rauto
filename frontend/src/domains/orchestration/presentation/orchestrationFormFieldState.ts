import { t } from "../../../lib/i18n.js";
import { selectOptionsWithCurrent } from "../../../lib/ui.js";
import {
  cloneJsonValue,
  nullableNumberValue,
  plainObject,
  stringValue,
} from "../../../lib/jsonValue.js";
import type {
  JsonObject,
  OrchestrationFieldDefinition,
  OrchestrationFieldDisplay,
  OrchestrationOptionRow,
} from "../model/types.js";

const orchestrationPlainObject = (value: unknown): value is JsonObject =>
  plainObject(value) === true;
const orchestrationStringValue = (value: unknown, fallback = ""): string =>
  stringValue(value, fallback);
const orchestrationNullableNumberValue = (value: unknown): number | null =>
  nullableNumberValue(value);
const orchestrationCloneJsonValue = <T>(value: unknown, fallback: T): T =>
  (cloneJsonValue as (source: unknown, fallbackValue: unknown) => unknown)(
    value,
    fallback,
  ) as T;
const orchestrationSelectOptionsWithCurrent = (
  rows: readonly unknown[],
  selected: unknown,
): unknown[] =>
  (
    selectOptionsWithCurrent as (
      options: readonly unknown[],
      current: unknown,
    ) => unknown[]
  )(rows, selected);

export const ORCHESTRATION_ROOT_FIELD_DEFS: readonly OrchestrationFieldDefinition[] =
  Object.freeze([
    {
      controlType: "input",
      fieldKey: "name",
      inputType: "text",
      labelKey: "orchestrationFormPlan",
    },
    {
      controlType: "select",
      fieldKey: "failFast",
      labelKey: "txBlockFormFailFast",
      optionKind: "boolean",
    },
    {
      controlType: "select",
      fieldKey: "rollbackOnStageFailure",
      labelKey: "orchestrationFormRollbackOnStageFailure",
      optionKind: "boolean",
    },
    {
      controlType: "select",
      fieldKey: "rollbackCompletedStagesOnFailure",
      labelKey: "orchestrationFormRollbackCompletedStages",
      optionKind: "boolean",
    },
  ]);

export const ORCHESTRATION_STAGE_FIELD_DEFS: readonly OrchestrationFieldDefinition[] =
  Object.freeze([
    {
      controlType: "input",
      fieldKey: "name",
      inputType: "text",
      labelKey: "txBlockFormName",
    },
    {
      controlType: "select",
      fieldKey: "strategy",
      labelKey: "txBlockFormMode",
      optionKind: "strategy",
    },
    {
      controlType: "input",
      fieldKey: "maxParallel",
      inputType: "number",
      labelKey: "orchestrationFormMaxParallel",
    },
    {
      controlType: "select",
      fieldKey: "failFast",
      labelKey: "txBlockFormFailFast",
      optionKind: "boolean",
    },
  ]);

export const ORCHESTRATION_JOB_FIELD_DEFS: readonly OrchestrationFieldDefinition[] =
  Object.freeze([
    {
      controlType: "input",
      fieldKey: "name",
      inputType: "text",
      labelKey: "orchestrationFormJob",
    },
    ...ORCHESTRATION_STAGE_FIELD_DEFS.slice(1),
  ]);

export function orchestrationJsonFieldText(
  jsonValue: unknown = {},
  fallback: unknown = {},
): string {
  return JSON.stringify(
    orchestrationCloneJsonValue(jsonValue, fallback),
    null,
    2,
  );
}

export function orchestrationNullableModeRows(): OrchestrationOptionRow[] {
  return [
    {
      optionLabel: t("txBlockNullableModeValue"),
      optionValue: "value",
    },
    {
      optionLabel: t("txBlockNullableModeNull"),
      optionValue: "null",
    },
  ];
}

function orchestrationStrategyOptionRows(
  strategyRows: readonly unknown[] = [],
  selected: unknown = "",
): OrchestrationOptionRow[] {
  return orchestrationSelectOptionsWithCurrent(strategyRows, selected).map(
    (optionValue) => ({
      optionLabel: t(
        optionValue === "parallel"
          ? "orchestrationStrategyParallel"
          : "orchestrationStrategySerial",
      ),
      optionValue,
    }),
  );
}

function orchestrationStageLikeFieldsDisplay(
  fieldDefs: readonly OrchestrationFieldDefinition[] = [],
  sourceValue: unknown = {},
  strategyRows: readonly unknown[] = [],
  booleanRows: readonly unknown[] = [],
  labelKeys: Record<string, string> = {},
): OrchestrationFieldDisplay[] {
  const value = orchestrationPlainObject(sourceValue) ? sourceValue : {};
  const showsJobNamePresenceToggle = fieldDefs.some(
    (stageLikeField) =>
      stageLikeField.fieldKey === "name" &&
      stageLikeField.labelKey === "orchestrationFormJob",
  );
  return fieldDefs.map((fieldDef) => {
    const labelKey = labelKeys[fieldDef.fieldKey] || fieldDef.labelKey;
    const presenceKey = `has${fieldDef.fieldKey[0].toUpperCase()}${fieldDef.fieldKey.slice(1)}`;
    if (fieldDef.optionKind === "strategy") {
      return {
        ...fieldDef,
        enabled: true,
        labelText: t(labelKey),
        optionRows: orchestrationStrategyOptionRows(
          strategyRows,
          orchestrationStringValue(value.strategy, "serial"),
        ),
        placeholderText: "",
        showPresenceToggle: false,
        valueText: orchestrationStringValue(value.strategy, "serial"),
      };
    }
    if (fieldDef.optionKind === "boolean") {
      const optionalBooleanValue =
        value.failFast === null || value.failFast === undefined
          ? ""
          : value.failFast
            ? "true"
            : "false";
      return {
        ...fieldDef,
        enabled: true,
        labelText: t(labelKey),
        optionRows: [
          {
            optionLabel: t("orchestrationOptionalInherit"),
            optionValue: "",
          },
          ...orchestrationSelectOptionsWithCurrent(
            booleanRows,
            optionalBooleanValue,
          )
            .filter(Boolean)
            .map((optionValue) => ({
              optionLabel: orchestrationStringValue(optionValue),
              optionValue,
            })),
        ],
        placeholderText: "",
        showPresenceToggle: false,
        valueText: optionalBooleanValue,
      };
    }
    const valueText =
      fieldDef.inputType === "number"
        ? (orchestrationNullableNumberValue(value[fieldDef.fieldKey]) ?? "")
        : orchestrationStringValue(value[fieldDef.fieldKey] ?? "");
    return {
      ...fieldDef,
      enabled: true,
      labelText: t(labelKey),
      nullableModeRows:
        fieldDef.fieldKey === "name" && showsJobNamePresenceToggle
          ? orchestrationNullableModeRows()
          : [],
      nullableModeValue:
        fieldDef.fieldKey === "name" && value.name === null ? "null" : "value",
      placeholderText: "",
      showNullableModeSelect: false,
      showPresenceToggle: false,
      valueText,
    };
  });
}

function orchestrationStageLikeFieldPatch(
  fieldKey: string = "",
  fieldValue: unknown = "",
): JsonObject {
  if (fieldKey === "name") {
    return { name: fieldValue, hasName: true };
  }
  if (fieldKey === "strategy") {
    return { strategy: fieldValue };
  }
  if (fieldKey === "maxParallel") {
    return fieldValue === ""
      ? { maxParallel: null, hasMaxParallel: false }
      : { maxParallel: fieldValue, hasMaxParallel: true };
  }
  return fieldValue === ""
    ? { failFast: null, hasFailFast: false }
    : { failFast: fieldValue === "true", hasFailFast: true };
}

export function orchestrationRootFieldsDisplay(
  model: unknown = {},
  booleanRows: readonly unknown[] = [],
): OrchestrationFieldDisplay[] {
  const rootValue = orchestrationPlainObject(model) ? model : {};
  return ORCHESTRATION_ROOT_FIELD_DEFS.map((fieldDef) => {
    const presenceKey = `has${fieldDef.fieldKey[0].toUpperCase()}${fieldDef.fieldKey.slice(1)}`;
    if (fieldDef.optionKind === "boolean") {
      const booleanValue = !!rootValue[fieldDef.fieldKey];
      const enabled =
        fieldDef.fieldKey === "failFast"
          ? !!rootValue[presenceKey] || rootValue.failFast !== true
          : !!rootValue[presenceKey] || booleanValue;
      return {
        ...fieldDef,
        enabled: true,
        labelText: t(fieldDef.labelKey),
        optionRows: orchestrationSelectOptionsWithCurrent(
          booleanRows,
          booleanValue ? "true" : "false",
        ).map((optionValue) => ({
          optionLabel: orchestrationStringValue(optionValue),
          optionValue,
        })),
        placeholderText: "",
        showPresenceToggle: false,
        valueText: booleanValue ? "true" : "false",
      };
    }
    return {
      ...fieldDef,
      enabled: true,
      labelText: t(fieldDef.labelKey),
      nullableModeRows: [],
      nullableModeValue: "value",
      placeholderText: "",
      showNullableModeSelect: false,
      showPresenceToggle: false,
      valueText: orchestrationStringValue(rootValue[fieldDef.fieldKey] ?? ""),
    };
  });
}

export function orchestrationStageFieldsDisplay(
  stage: unknown = {},
  strategyRows: readonly unknown[] = [],
  booleanRows: readonly unknown[] = [],
): OrchestrationFieldDisplay[] {
  return orchestrationStageLikeFieldsDisplay(
    ORCHESTRATION_STAGE_FIELD_DEFS,
    stage,
    strategyRows,
    booleanRows,
    {
      name: "orchestrationStageNameLabel",
      strategy: "orchestrationStageStrategyLabel",
      maxParallel: "orchestrationStageMaxParallelLabel",
      failFast: "orchestrationStageFailFastLabel",
    },
  );
}

export function orchestrationJobFieldsDisplay(
  job: unknown = {},
  strategyRows: readonly unknown[] = [],
  booleanRows: readonly unknown[] = [],
): OrchestrationFieldDisplay[] {
  return orchestrationStageLikeFieldsDisplay(
    ORCHESTRATION_JOB_FIELD_DEFS,
    job,
    strategyRows,
    booleanRows,
    {
      name: "orchestrationJobNameLabel",
      strategy: "orchestrationJobStrategyLabel",
      maxParallel: "orchestrationJobMaxParallelLabel",
      failFast: "orchestrationJobFailFastLabel",
    },
  );
}

export function orchestrationStageFieldPatch(
  fieldKey: string = "",
  fieldValue: unknown = "",
): JsonObject {
  return orchestrationStageLikeFieldPatch(fieldKey, fieldValue);
}

export function orchestrationJobFieldPatch(
  fieldKey: string = "",
  fieldValue: unknown = "",
): JsonObject {
  return orchestrationStageLikeFieldPatch(fieldKey, fieldValue);
}

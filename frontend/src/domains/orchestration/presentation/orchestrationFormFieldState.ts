import { t } from "../../../lib/i18n.js";
import { selectOptionsWithCurrent } from "../../../lib/ui.js";
import { cloneJsonValue } from "../../../lib/jsonValue.js";
import type {
  JsonObject,
  OrchestrationFieldDefinition,
  OrchestrationFieldDisplay,
  OrchestrationJobModel,
  OrchestrationOptionRow,
  OrchestrationPlanFormModel,
  OrchestrationStageModel,
  OrchestrationStrategy,
} from "../model/types.js";

const orchestrationSelectOptionsWithCurrent = (
  rows: readonly string[],
  selected: string,
): string[] => selectOptionsWithCurrent(rows, selected);

interface OrchestrationStageLikeModel {
  failFast?: boolean | null;
  maxParallel?: number | null;
  name?: string | null;
  strategy?: OrchestrationStrategy;
}

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
  jsonValue: JsonObject = {},
  fallback: JsonObject = {},
): string {
  return JSON.stringify(cloneJsonValue(jsonValue, fallback), null, 2);
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
  strategyRows: readonly string[] = [],
  selected = "",
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
  sourceValue: OrchestrationStageLikeModel = {},
  strategyRows: readonly string[] = [],
  booleanRows: readonly string[] = [],
  labelKeys: Record<string, string> = {},
): OrchestrationFieldDisplay[] {
  const showsJobNamePresenceToggle = fieldDefs.some(
    (stageLikeField) =>
      stageLikeField.fieldKey === "name" &&
      stageLikeField.labelKey === "orchestrationFormJob",
  );
  return fieldDefs.map((fieldDef) => {
    const labelKey = labelKeys[fieldDef.fieldKey] || fieldDef.labelKey;
    if (fieldDef.optionKind === "strategy") {
      const strategy = sourceValue.strategy ?? "serial";
      return {
        ...fieldDef,
        enabled: true,
        labelText: t(labelKey),
        optionRows: orchestrationStrategyOptionRows(strategyRows, strategy),
        placeholderText: "",
        showPresenceToggle: false,
        valueText: strategy,
      };
    }
    if (fieldDef.optionKind === "boolean") {
      const optionalBooleanValue =
        sourceValue.failFast == null
          ? ""
          : sourceValue.failFast
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
              optionLabel: optionValue,
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
        ? String(sourceValue.maxParallel ?? "")
        : (sourceValue.name ?? "");
    return {
      ...fieldDef,
      enabled: true,
      labelText: t(labelKey),
      nullableModeRows:
        fieldDef.fieldKey === "name" && showsJobNamePresenceToggle
          ? orchestrationNullableModeRows()
          : [],
      nullableModeValue:
        fieldDef.fieldKey === "name" && sourceValue.name === null
          ? "null"
          : "value",
      placeholderText: "",
      showNullableModeSelect: false,
      showPresenceToggle: false,
      valueText,
    };
  });
}

function orchestrationStageLikeFieldPatch(
  fieldKey: string = "",
  fieldValue: string = "",
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
  model: Partial<OrchestrationPlanFormModel> = {},
  booleanRows: readonly string[] = [],
): OrchestrationFieldDisplay[] {
  return ORCHESTRATION_ROOT_FIELD_DEFS.map((fieldDef) => {
    if (fieldDef.optionKind === "boolean") {
      const booleanValue =
        fieldDef.fieldKey === "failFast"
          ? !!model.failFast
          : fieldDef.fieldKey === "rollbackOnStageFailure"
            ? !!model.rollbackOnStageFailure
            : !!model.rollbackCompletedStagesOnFailure;
      return {
        ...fieldDef,
        enabled: true,
        labelText: t(fieldDef.labelKey),
        optionRows: orchestrationSelectOptionsWithCurrent(
          booleanRows,
          booleanValue ? "true" : "false",
        ).map((optionValue) => ({
          optionLabel: optionValue,
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
      valueText: model.name ?? "",
    };
  });
}

export function orchestrationStageFieldsDisplay(
  stage: Partial<OrchestrationStageModel> = {},
  strategyRows: readonly string[] = [],
  booleanRows: readonly string[] = [],
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
  job: Partial<OrchestrationJobModel> = {},
  strategyRows: readonly string[] = [],
  booleanRows: readonly string[] = [],
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
  fieldValue: string = "",
): JsonObject {
  return orchestrationStageLikeFieldPatch(fieldKey, fieldValue);
}

export function orchestrationJobFieldPatch(
  fieldKey: string = "",
  fieldValue: string = "",
): JsonObject {
  return orchestrationStageLikeFieldPatch(fieldKey, fieldValue);
}

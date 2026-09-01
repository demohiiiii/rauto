import { currentLanguage, t, tr } from "../../../lib/i18n.js";
import {
  nullableNumberValue,
  plainObject,
  stringValue,
} from "../../../lib/jsonValue.js";
import { selectOptionsWithCurrent as selectOptionsWithCurrentBase } from "../../../lib/ui.js";
import { txCommandPromptExtraSource } from "../model/transactionBlockMutations.js";
import { txBlockPromptMetadataFieldDefs } from "../model/transactionStructure.js";
import { txExtraStringFieldRows } from "../model/transactionMetadataFields.js";
import type {
  JsonObject,
  TxBlockFormModel,
  TxCommandInteractionModel,
  TxCommandModel,
  TxFlowModel,
  TxOperationModel,
  TxRuntimePromptModel,
  TxStepFormModel,
  TxValidationError,
  TxWholeResourceRollbackModel,
} from "../model/types.js";

interface TxBlockFieldDefinition {
  controlType: string;
  fieldKey: string;
  inputType?: string;
  labelKey?: string;
  optionKind?: string;
  placeholderKey?: string;
}

interface TxBlockFieldRow extends JsonObject {
  fieldKey: string;
}

interface TxCommandModeState extends JsonObject {
  modes?: unknown[];
}

type PartialJson<T extends JsonObject> = Partial<T> & JsonObject;

const txPlainObject = plainObject as unknown as (
  value: unknown,
) => value is JsonObject;
const txStringValue = stringValue as unknown as (
  value: unknown,
  fallback?: string,
) => string;
const txNullableNumberValue = nullableNumberValue as unknown as (
  value: unknown,
) => number | null;
const selectOptionsWithCurrent = selectOptionsWithCurrentBase as unknown as (
  options: readonly unknown[],
  currentValue: unknown,
) => string[];

function txObject<T extends JsonObject>(value: unknown): PartialJson<T> {
  return txPlainObject(value) ? (value as PartialJson<T>) : {};
}

export function txBlockValidationErrorText(
  errors: readonly TxValidationError[] = [],
  path = "",
): string {
  const error = errors.find((validationError) => validationError.path === path);
  return error?.messageKey ? t(error.messageKey) : "";
}

export function txBlockFieldRowsWithValidation<T extends TxBlockFieldRow>(
  fieldRows: readonly T[] = [],
  errors: readonly TxValidationError[] = [],
  pathPrefix = "",
): Array<T & { errorText: string }> {
  return fieldRows.map((fieldRow) => ({
    ...fieldRow,
    errorText: txBlockValidationErrorText(
      errors,
      pathPrefix ? `${pathPrefix}.${fieldRow.fieldKey}` : fieldRow.fieldKey,
    ),
  }));
}

export const TX_BLOCK_OPERATION_KIND_ROWS = Object.freeze(["command", "flow"]);
export const TX_BLOCK_ROLLBACK_KIND_ROWS = Object.freeze([
  "none",
  "per_step",
  "whole_resource",
]);
export const TX_BLOCK_BOOLEAN_ROWS = Object.freeze(["true", "false"]);
export const TX_BLOCK_JSON_VALUE_TYPE_ROWS = Object.freeze([
  "string",
  "number",
  "boolean",
  "null",
  "json",
]);

const TX_BLOCK_COMMAND_FIELD_DEFS: readonly TxBlockFieldDefinition[] =
  Object.freeze([
    {
      controlType: "mode-expression",
      fieldKey: "mode",
      labelKey: "txBlockFormMode",
      placeholderKey: "txBlockFormModePlaceholder",
      optionKind: "profileMode",
    },
    {
      controlType: "input",
      fieldKey: "command",
      inputType: "text",
      labelKey: "txBlockFormCommand",
      placeholderKey: "txBlockFormCommandPlaceholder",
    },
    {
      controlType: "input",
      fieldKey: "timeout",
      inputType: "number",
      labelKey: "txBlockFormTimeout",
      placeholderKey: "txBlockFormTimeoutSecsPlaceholder",
    },
  ]);

const TX_BLOCK_FLOW_FIELD_DEFS: readonly TxBlockFieldDefinition[] =
  Object.freeze([
    {
      controlType: "select",
      fieldKey: "stopOnError",
      labelKey: "txBlockFormStopOnError",
      optionKind: "boolean",
    },
    {
      controlType: "input",
      fieldKey: "maxSteps",
      inputType: "number",
      labelKey: "txBlockFormMaxSteps",
      placeholderKey: "txBlockFormTimeoutSecsPlaceholder",
    },
  ]);

const TX_BLOCK_COMMAND_PROMPT_FIELD_DEFS: readonly TxBlockFieldDefinition[] =
  Object.freeze([
    {
      controlType: "textarea",
      fieldKey: "patterns",
      labelKey: "txBlockFormPatterns",
    },
    {
      controlType: "textarea",
      fieldKey: "response",
      labelKey: "txBlockFormResponse",
    },
    {
      controlType: "select",
      fieldKey: "recordInput",
      labelKey: "fieldRecordInput",
      optionKind: "boolean",
    },
  ]);

const TX_BLOCK_ROOT_FIELD_DEFS: readonly TxBlockFieldDefinition[] =
  Object.freeze([
    {
      controlType: "input",
      fieldKey: "name",
      inputType: "text",
      labelKey: "txBlockFormName",
      placeholderKey: "txBlockFormNamePlaceholder",
    },
    {
      controlType: "select",
      fieldKey: "failFast",
      labelKey: "txBlockFormFailFast",
      optionKind: "boolean",
    },
  ]);

const TX_BLOCK_STEP_FIELD_DEFS: readonly TxBlockFieldDefinition[] =
  Object.freeze([
    {
      controlType: "select",
      fieldKey: "rollbackOnFailure",
      labelKey: "txBlockFormRollbackOnFailure",
      optionKind: "boolean",
    },
  ]);

const TX_BLOCK_OPERATION_FIELD_DEFS: readonly TxBlockFieldDefinition[] =
  Object.freeze([
    {
      controlType: "select",
      fieldKey: "kind",
    },
  ]);

const TX_BLOCK_WHOLE_RESOURCE_FIELD_DEFS: readonly TxBlockFieldDefinition[] =
  Object.freeze([
    {
      controlType: "input",
      fieldKey: "triggerStepIndex",
      inputType: "number",
      labelKey: "txBlockFormTriggerStepIndex",
    },
  ]);

function txBlockCommandModeOptionRows(
  currentValue: unknown = "",
  commandModeState: unknown = {},
) {
  const modeState = txObject<TxCommandModeState>(commandModeState);
  const selectedMode = txStringValue(currentValue).trim();
  const modeOptions = Array.isArray(modeState.modes) ? modeState.modes : [];
  return selectOptionsWithCurrent(modeOptions, selectedMode).map(
    (modeOption) => ({
      optionLabel: modeOption,
      optionValue: modeOption,
    }),
  );
}

function txBlockCommandDynParamExtraRows(command: unknown = {}) {
  const commandValue = txObject<TxCommandModel>(command);
  const dynParams = txPlainObject(commandValue.dynParams)
    ? commandValue.dynParams
    : {};
  return Object.entries(dynParams).map(([key, value]) => ({
    keyText: String(key),
    valueText: txStringValue(value),
  }));
}

function txBlockCommandPromptRows(command: unknown = {}): unknown[] {
  const commandValue = txObject<TxCommandModel>(command);
  const interaction = txObject<TxCommandInteractionModel>(
    commandValue.interaction,
  );
  return Array.isArray(interaction.prompts) ? interaction.prompts : [];
}

function txBlockCommandPromptMetadataRows(
  command: unknown = {},
  promptIndex = 0,
) {
  return txExtraStringFieldRows(
    txCommandPromptExtraSource(txObject<TxCommandModel>(command), promptIndex),
    txBlockPromptMetadataFieldDefs(),
  );
}

function txBlockCommandPromptPatternRows(prompt: unknown = {}) {
  const promptValue = txObject<TxRuntimePromptModel>(prompt);
  return (Array.isArray(promptValue.patterns) ? promptValue.patterns : []).map(
    (patternValue, itemIndex) => ({
      itemIndex,
      text: txStringValue(patternValue),
    }),
  );
}

function txBlockCommandInteractionPromptRow(
  command: unknown = {},
  prompt: unknown = {},
  promptIndex = 0,
  booleanRows: readonly unknown[] = [],
) {
  const fieldRows = txBlockCommandPromptFieldsDisplay(prompt, booleanRows);
  return {
    controlFieldRows: fieldRows.filter(
      (fieldRow) => fieldRow.controlType !== "textarea",
    ),
    fieldRows,
    metadataFieldRows: txBlockCommandPromptMetadataRows(command, promptIndex),
    patternRows: txBlockCommandPromptPatternRows(prompt),
    prompt,
    promptIndex,
    textAreaFieldRows: fieldRows.filter(
      (fieldRow) => fieldRow.controlType === "textarea",
    ),
  };
}

export function txBlockCommandFieldsDisplay(
  command: unknown = {},
  commandModeState: unknown = {},
  validationErrors: readonly TxValidationError[] = [],
  pathPrefix = "",
) {
  const commandValue = txObject<TxCommandModel>(command);
  const modeState = txObject<TxCommandModeState>(commandModeState);
  const modeOptions = Array.isArray(modeState.modes) ? modeState.modes : [];
  const fieldRows = TX_BLOCK_COMMAND_FIELD_DEFS.map((fieldDef) => {
    const presenceKey = `has${fieldDef.fieldKey[0].toUpperCase()}${fieldDef.fieldKey.slice(1)}`;
    const enabled =
      fieldDef.fieldKey === "timeout"
        ? !!commandValue[presenceKey] ||
          commandValue[fieldDef.fieldKey] !== null
        : true;
    const valueText =
      fieldDef.inputType === "number"
        ? (txNullableNumberValue(commandValue[fieldDef.fieldKey]) ?? "")
        : txStringValue(commandValue[fieldDef.fieldKey] ?? "");
    if (fieldDef.optionKind === "profileMode") {
      return {
        ...fieldDef,
        enabled,
        labelText: t(fieldDef.labelKey),
        optionValues: modeOptions,
        optionRows: txBlockCommandModeOptionRows(valueText, commandModeState),
        placeholderText: fieldDef.placeholderKey
          ? t(fieldDef.placeholderKey)
          : "",
        showPresenceToggle: false,
        valueText,
      };
    }
    return {
      ...fieldDef,
      enabled,
      labelText: t(fieldDef.labelKey),
      placeholderText: fieldDef.placeholderKey
        ? t(fieldDef.placeholderKey)
        : "",
      showPresenceToggle: fieldDef.fieldKey === "timeout",
      valueText,
    };
  });
  return txBlockFieldRowsWithValidation(
    fieldRows,
    validationErrors,
    pathPrefix,
  );
}

export function txBlockFlowFieldsDisplay(
  flow: unknown = {},
  booleanRows: readonly unknown[] = [],
  validationErrors: readonly TxValidationError[] = [],
  pathPrefix = "",
) {
  const flowValue = txObject<TxFlowModel>(flow);
  const fieldRows = TX_BLOCK_FLOW_FIELD_DEFS.map((fieldDef) => {
    const presenceKey = `has${fieldDef.fieldKey[0].toUpperCase()}${fieldDef.fieldKey.slice(1)}`;
    const enabled =
      fieldDef.fieldKey === "stopOnError"
        ? !!flowValue[presenceKey] || flowValue.stopOnError !== true
        : !!flowValue[presenceKey] || flowValue[fieldDef.fieldKey] !== null;
    if (fieldDef.optionKind === "boolean") {
      return {
        ...fieldDef,
        enabled,
        labelText: t(fieldDef.labelKey),
        optionRows: selectOptionsWithCurrent(
          booleanRows,
          flowValue.stopOnError ? "true" : "false",
        ).map((optionValue) => ({
          optionLabel: optionValue,
          optionValue,
        })),
        placeholderText: "",
        showPresenceToggle: true,
        valueText: flowValue.stopOnError ? "true" : "false",
      };
    }
    return {
      ...fieldDef,
      enabled,
      labelText: t(fieldDef.labelKey),
      placeholderText: fieldDef.placeholderKey
        ? t(fieldDef.placeholderKey)
        : "",
      showPresenceToggle: true,
      valueText: txNullableNumberValue(flowValue[fieldDef.fieldKey]) ?? "",
    };
  });
  return txBlockFieldRowsWithValidation(
    fieldRows,
    validationErrors,
    pathPrefix,
  );
}

export function txBlockCommandPromptFieldsDisplay(
  prompt: unknown = {},
  booleanRows: readonly unknown[] = [],
) {
  const promptValue = txObject<TxRuntimePromptModel>(prompt);
  return TX_BLOCK_COMMAND_PROMPT_FIELD_DEFS.map((fieldDef) => {
    const presenceKey = `has${fieldDef.fieldKey[0].toUpperCase()}${fieldDef.fieldKey.slice(1)}`;
    if (fieldDef.optionKind === "boolean") {
      return {
        ...fieldDef,
        enabled: !!promptValue[presenceKey] || !!promptValue.recordInput,
        labelText: t(fieldDef.labelKey),
        optionRows: selectOptionsWithCurrent(
          booleanRows,
          promptValue.recordInput ? "true" : "false",
        ).map((optionValue) => ({
          optionLabel: optionValue,
          optionValue,
        })),
        placeholderText: "",
        showPresenceToggle: true,
        valueText: promptValue.recordInput ? "true" : "false",
      };
    }
    return {
      ...fieldDef,
      enabled: true,
      labelText: t(fieldDef.labelKey),
      placeholderText: "",
      showPresenceToggle: false,
      valueText:
        fieldDef.fieldKey === "patterns"
          ? (Array.isArray(promptValue.patterns)
              ? promptValue.patterns
              : []
            ).join("\n")
          : txStringValue(promptValue.response),
    };
  });
}

export function txBlockCommandInteractionDisplay(
  command: unknown = {},
  booleanRows: readonly unknown[] = [],
) {
  const commandValue = txObject<TxCommandModel>(command);
  const interaction = txObject<TxCommandInteractionModel>(
    commandValue.interaction,
  );
  const promptRows = Array.isArray(interaction.prompts)
    ? interaction.prompts.map((prompt, promptIndex) =>
        txBlockCommandInteractionPromptRow(
          command,
          prompt,
          promptIndex,
          booleanRows,
        ),
      )
    : [];
  return {
    interactionPresent:
      !!commandValue.hasInteraction ||
      promptRows.length > 0 ||
      Object.keys(txPlainObject(interaction.extra) ? interaction.extra : {})
        .length > 0,
    promptsPresent: !!interaction.hasPrompts || promptRows.length > 0,
    promptRows,
  };
}

export function txBlockRootFieldsDisplay(
  model: unknown = {},
  booleanRows: readonly unknown[] = [],
) {
  const rootValue = txObject<TxBlockFormModel>(model);
  return TX_BLOCK_ROOT_FIELD_DEFS.map((fieldDef) => {
    if (fieldDef.optionKind === "boolean") {
      return {
        ...fieldDef,
        enabled: !!rootValue.hasFailFast || rootValue.failFast !== true,
        labelText: t(fieldDef.labelKey),
        optionRows: selectOptionsWithCurrent(
          booleanRows,
          rootValue.failFast ? "true" : "false",
        ).map((optionValue) => ({
          optionLabel: optionValue,
          optionValue,
        })),
        placeholderText: "",
        showPresenceToggle: true,
        valueText: rootValue.failFast ? "true" : "false",
      };
    }
    return {
      ...fieldDef,
      enabled: true,
      labelText: t(fieldDef.labelKey),
      placeholderText: fieldDef.placeholderKey
        ? t(fieldDef.placeholderKey)
        : "",
      showPresenceToggle: false,
      valueText: txStringValue(rootValue[fieldDef.fieldKey]),
    };
  });
}

export function txBlockWholeResourceFieldsDisplay(
  wholeResource: unknown = {},
  validationErrors: readonly TxValidationError[] = [],
  pathPrefix = "rollbackPolicy.wholeResource",
) {
  const wholeResourceValue =
    txObject<TxWholeResourceRollbackModel>(wholeResource);
  return txBlockFieldRowsWithValidation(
    TX_BLOCK_WHOLE_RESOURCE_FIELD_DEFS.map((fieldDef) => ({
      ...fieldDef,
      enabled:
        !!wholeResourceValue.hasTriggerStepIndex ||
        wholeResourceValue[fieldDef.fieldKey] !== null,
      labelText: t(fieldDef.labelKey),
      placeholderText: fieldDef.placeholderKey
        ? t(fieldDef.placeholderKey)
        : "",
      showPresenceToggle: true,
      valueText:
        txNullableNumberValue(wholeResourceValue[fieldDef.fieldKey]) ?? "",
    })),
    validationErrors,
    pathPrefix,
  );
}

export function txBlockStepFieldsDisplay(step: unknown = {}) {
  const stepValue = txObject<TxStepFormModel>(step);
  return TX_BLOCK_STEP_FIELD_DEFS.map((fieldDef) => ({
    ...fieldDef,
    enabled: !!stepValue.hasRollbackOnFailure || !!stepValue.rollbackOnFailure,
    labelText: t(fieldDef.labelKey),
    optionRows: TX_BLOCK_BOOLEAN_ROWS.map((optionValue) => ({
      optionLabel: optionValue,
      optionValue,
    })),
    placeholderText: "",
    showPresenceToggle: true,
    valueText: stepValue.rollbackOnFailure ? "true" : "false",
  }));
}

export function txBlockRootPanelDisplay(
  model: unknown = {},
  visualDisplay: unknown = {},
) {
  const rootValue = txObject<TxBlockFormModel>(model);
  const visualDisplayValue = txObject<JsonObject>(visualDisplay);
  return {
    fieldRows: txBlockRootFieldsDisplay(
      rootValue,
      Array.isArray(visualDisplayValue.booleanRows)
        ? visualDisplayValue.booleanRows
        : [],
    ),
  };
}

export function txBlockRollbackPolicyPanelDisplay(
  model: unknown = {},
  visualDisplay: unknown = {},
  validationErrors: readonly TxValidationError[] = [],
) {
  const rootValue = txObject<TxBlockFormModel>(model);
  const visualDisplayValue = txObject<JsonObject>(visualDisplay);
  const wholeResourcePolicy =
    rootValue.rollbackPolicy?.kind === "whole_resource"
      ? rootValue.rollbackPolicy?.wholeResource || null
      : null;
  return {
    rollbackKindValue: txStringValue(rootValue.rollbackPolicy?.kind, "none"),
    showWholeResource: rootValue.rollbackPolicy?.kind === "whole_resource",
    wholeResourceExtra: txPlainObject(wholeResourcePolicy?.extra)
      ? wholeResourcePolicy.extra
      : {},
    wholeResourceFieldRows: txBlockWholeResourceFieldsDisplay(
      wholeResourcePolicy || {},
      validationErrors,
    ),
    wholeResourceRollback: wholeResourcePolicy?.rollback || null,
    wholeResourceTypeRows: Array.isArray(visualDisplayValue.jsonValueTypeRows)
      ? visualDisplayValue.jsonValueTypeRows
      : [],
  };
}

export function txBlockStepsPanelDisplay(model: unknown = {}) {
  const rootValue = txObject<TxBlockFormModel>(model);
  return {
    stepRows: (Array.isArray(rootValue.steps) ? rootValue.steps : []).map(
      (step, stepIndex) => ({
        step,
        stepIndex,
        titleText: `${t("txBlockFormStep")} ${stepIndex + 1}`,
      }),
    ),
  };
}

function txBlockLocalizedFallback(
  key: string,
  englishText: string,
  chineseText: string,
): string {
  return tr(key, currentLanguage() === "zh" ? chineseText : englishText);
}

function txBlockOperationKindText(kind: unknown): string {
  if (kind === "flow") return t("txBlockFormFlowSteps");
  return t("txBlockFormCommand");
}

function txBlockOperationSummaryText(operation: unknown = {}): string {
  const operationValue = txObject<TxOperationModel>(operation);
  if (operationValue.kind === "flow") {
    const flowValue = txObject<TxFlowModel>(operationValue.flow);
    const stepCount = Array.isArray(flowValue.steps)
      ? flowValue.steps.length
      : 0;
    return `${t("txBlockFormFlowSteps")} · ${stepCount}`;
  }
  return (
    txStringValue(
      txObject<TxCommandModel>(operationValue.command).command,
    ).trim() ||
    txBlockLocalizedFallback(
      "txBlockTimelineEmptyCommand",
      "Empty command",
      "空命令",
    )
  );
}

export function txBlockTimelineDisplay(model: unknown = {}) {
  const modelValue = txObject<TxBlockFormModel>(model);
  const steps = Array.isArray(modelValue.steps) ? modelValue.steps : [];
  return {
    stepRows: steps.map((step, stepIndex) => ({
      canMoveDown: stepIndex < steps.length - 1,
      canMoveUp: stepIndex > 0,
      kindText: txBlockOperationKindText(step?.run?.kind),
      rollbackConfigured: !!step?.rollback,
      stepIndex,
      summaryText: txBlockOperationSummaryText(step?.run),
      titleText: `${t("txBlockFormStep")} ${stepIndex + 1}`,
    })),
  };
}

export function txBlockOperationFieldsDisplay(
  operation: unknown = {},
  titleText = "",
) {
  const operationValue = txObject<TxOperationModel>(operation);
  return TX_BLOCK_OPERATION_FIELD_DEFS.map((fieldDef) => ({
    ...fieldDef,
    enabled: true,
    labelText: titleText,
    optionRows: TX_BLOCK_OPERATION_KIND_ROWS.map((optionValue) => ({
      optionLabel: optionValue,
      optionValue,
    })),
    placeholderText: "",
    showPresenceToggle: false,
    valueText: txStringValue(operationValue[fieldDef.fieldKey]),
  }));
}

export function txBlockCommandEditorDisplay(
  command: unknown = {},
  commandModeState: unknown = {},
  validationErrors: readonly TxValidationError[] = [],
  pathPrefix = "",
) {
  const commandValue = txObject<TxCommandModel>(command);
  return {
    dynParamExtraRows: txBlockCommandDynParamExtraRows(command),
    fieldRows: txBlockCommandFieldsDisplay(
      command,
      commandModeState,
      validationErrors,
      pathPrefix,
    ),
    interactionDisplay: txBlockCommandInteractionDisplay(
      command,
      TX_BLOCK_BOOLEAN_ROWS,
    ),
    multilineMode:
      commandValue.multilineMode === "whole" ? "whole" : "split_lines",
    promptRows: txBlockCommandPromptRows(command),
  };
}

export function txBlockCommandDynParamsDisplay(
  command: unknown = {},
  commandDisplay: unknown = {},
) {
  const commandValue = txObject<TxCommandModel>(command);
  const commandDisplayValue = txObject<JsonObject>(commandDisplay);
  const dynParamExtraRows = Array.isArray(commandDisplayValue.dynParamExtraRows)
    ? commandDisplayValue.dynParamExtraRows
    : [];
  return {
    dynParamExtraRows,
    dynParamsPresent:
      !!commandValue.hasDynParams || dynParamExtraRows.length > 0,
  };
}

import { currentLanguage, t, tr } from "../../lib/i18n.js";
import {
  nullableNumberValue,
  plainObject,
  stringValue,
} from "../../lib/jsonValue.js";
import { selectOptionsWithCurrent } from "../../lib/ui.js";
import { txCommandPromptExtraSource } from "./transactionBlockMutations.js";
import {
  txBlockFlowMetadataFieldDefs,
  txBlockPromptMetadataFieldDefs,
} from "./transactionStructure.js";
import { txExtraStringFieldRows } from "./transactionMetadataFields.js";

const txPlainObject = plainObject;
const txStringValue = stringValue;
const txNullableNumberValue = nullableNumberValue;

export function txBlockValidationErrorText(errors = [], path = "") {
  const error = Array.isArray(errors)
    ? errors.find((validationError) => validationError?.path === path)
    : null;
  return error?.messageKey ? t(error.messageKey) : "";
}

export function txBlockFieldRowsWithValidation(
  fieldRows = [],
  errors = [],
  pathPrefix = "",
) {
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

const TX_BLOCK_COMMAND_FIELD_DEFS = Object.freeze([
  {
    controlType: "select",
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

const TX_BLOCK_FLOW_FIELD_DEFS = Object.freeze([
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

const TX_BLOCK_COMMAND_PROMPT_FIELD_DEFS = Object.freeze([
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

const TX_BLOCK_ROOT_FIELD_DEFS = Object.freeze([
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

const TX_BLOCK_STEP_FIELD_DEFS = Object.freeze([
  {
    controlType: "select",
    fieldKey: "rollbackOnFailure",
    labelKey: "txBlockFormRollbackOnFailure",
    optionKind: "boolean",
  },
]);

const TX_BLOCK_OPERATION_FIELD_DEFS = Object.freeze([
  {
    controlType: "select",
    fieldKey: "kind",
  },
]);

const TX_BLOCK_WHOLE_RESOURCE_FIELD_DEFS = Object.freeze([
  {
    controlType: "input",
    fieldKey: "triggerStepIndex",
    inputType: "number",
    labelKey: "txBlockFormTriggerStepIndex",
  },
]);

function txBlockCommandModeOptionRows(
  currentValue = "",
  commandModeState = {},
) {
  const selectedMode = txStringValue(currentValue).trim();
  const modeOptions = Array.isArray(commandModeState?.modes)
    ? commandModeState.modes
    : [];
  return selectOptionsWithCurrent(modeOptions, selectedMode).map(
    (modeOption) => ({
      optionLabel: modeOption,
      optionValue: modeOption,
    }),
  );
}

function txBlockCommandDynParamExtraRows(command = {}) {
  const dynParams = txPlainObject(command.dynParams) ? command.dynParams : {};
  return Object.entries(dynParams).map(([key, value]) => ({
    keyText: String(key),
    valueText: txStringValue(value),
  }));
}

function txBlockCommandPromptRows(command = {}) {
  return Array.isArray(command?.interaction?.prompts)
    ? command.interaction.prompts
    : [];
}

function txBlockCommandPromptMetadataRows(command = {}, promptIndex = 0) {
  return txExtraStringFieldRows(
    txCommandPromptExtraSource(command, promptIndex),
    txBlockPromptMetadataFieldDefs(),
  );
}

function txBlockCommandPromptPatternRows(prompt = {}) {
  return (Array.isArray(prompt?.patterns) ? prompt.patterns : []).map(
    (patternValue, itemIndex) => ({
      itemIndex,
      text: txStringValue(patternValue),
    }),
  );
}

function txBlockCommandInteractionPromptRow(
  command = {},
  prompt = {},
  promptIndex = 0,
  booleanRows = [],
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
  command = {},
  commandModeState = {},
  validationErrors = [],
  pathPrefix = "",
) {
  const commandValue = txPlainObject(command) ? command : {};
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
        optionRows: txBlockCommandModeOptionRows(valueText, commandModeState),
        placeholderText: "",
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
  flow = {},
  booleanRows = [],
  validationErrors = [],
  pathPrefix = "",
) {
  const flowValue = txPlainObject(flow) ? flow : {};
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
  prompt = {},
  booleanRows = [],
) {
  const promptValue = txPlainObject(prompt) ? prompt : {};
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
  command = {},
  booleanRows = [],
) {
  const interaction = txPlainObject(command?.interaction)
    ? command.interaction
    : { prompts: [], hasPrompts: false, extra: {} };
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
      !!command?.hasInteraction ||
      promptRows.length > 0 ||
      Object.keys(txPlainObject(interaction.extra) ? interaction.extra : {})
        .length > 0,
    promptsPresent: !!interaction.hasPrompts || promptRows.length > 0,
    promptRows,
  };
}

export function txBlockRootFieldsDisplay(model = {}, booleanRows = []) {
  const rootValue = txPlainObject(model) ? model : {};
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
  wholeResource = {},
  validationErrors = [],
  pathPrefix = "rollbackPolicy.wholeResource",
) {
  const wholeResourceValue = txPlainObject(wholeResource) ? wholeResource : {};
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

export function txBlockStepFieldsDisplay(step = {}) {
  const stepValue = txPlainObject(step) ? step : {};
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

export function txBlockRootPanelDisplay(model = {}, visualDisplay = {}) {
  const rootValue = txPlainObject(model) ? model : {};
  return {
    fieldRows: txBlockRootFieldsDisplay(
      rootValue,
      Array.isArray(visualDisplay.booleanRows) ? visualDisplay.booleanRows : [],
    ),
  };
}

export function txBlockRollbackPolicyPanelDisplay(
  model = {},
  visualDisplay = {},
  validationErrors = [],
) {
  const rootValue = txPlainObject(model) ? model : {};
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
    wholeResourceTypeRows: Array.isArray(visualDisplay.jsonValueTypeRows)
      ? visualDisplay.jsonValueTypeRows
      : [],
  };
}

export function txBlockStepsPanelDisplay(model = {}) {
  const rootValue = txPlainObject(model) ? model : {};
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

function txBlockLocalizedFallback(key, englishText, chineseText) {
  return tr(key, currentLanguage() === "zh" ? chineseText : englishText);
}

function txBlockOperationKindText(kind) {
  if (kind === "flow") return t("txBlockFormFlowSteps");
  return t("txBlockFormCommand");
}

function txBlockOperationSummaryText(operation = {}) {
  if (operation?.kind === "flow") {
    const stepCount = Array.isArray(operation.flow?.steps)
      ? operation.flow.steps.length
      : 0;
    return `${t("txBlockFormFlowSteps")} · ${stepCount}`;
  }
  return (
    txStringValue(operation?.command?.command).trim() ||
    txBlockLocalizedFallback(
      "txBlockTimelineEmptyCommand",
      "Empty command",
      "空命令",
    )
  );
}

export function txBlockTimelineDisplay(model = {}) {
  const steps = Array.isArray(model?.steps) ? model.steps : [];
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

export function txBlockOperationFieldsDisplay(operation = {}, titleText = "") {
  const operationValue = txPlainObject(operation) ? operation : {};
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
  command = {},
  commandModeState = {},
  validationErrors = [],
  pathPrefix = "",
) {
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
    multilineMode: command?.multilineMode === "whole" ? "whole" : "split_lines",
    promptRows: txBlockCommandPromptRows(command),
  };
}

export function txBlockCommandDynParamsDisplay(
  command = {},
  commandDisplay = {},
) {
  const commandValue = txPlainObject(command) ? command : {};
  const commandDisplayValue = txPlainObject(commandDisplay)
    ? commandDisplay
    : {};
  const dynParamExtraRows = Array.isArray(commandDisplayValue.dynParamExtraRows)
    ? commandDisplayValue.dynParamExtraRows
    : [];
  return {
    dynParamExtraRows,
    dynParamsPresent:
      !!commandValue.hasDynParams || dynParamExtraRows.length > 0,
  };
}

export function txBlockFlowMetadataFieldRows(operation = {}) {
  return txExtraStringFieldRows(
    operation?.flow?.extra,
    txBlockFlowMetadataFieldDefs(),
  );
}

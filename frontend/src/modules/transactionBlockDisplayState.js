import { t } from "../lib/i18n.js";
import {
  jsonValueText,
  nullableNumberValue,
  plainObject,
  stringValue,
} from "../lib/jsonValue.js";
import { selectOptionsWithCurrent } from "../lib/ui.js";
import {
  txCommandPromptExtraSource,
  txInteractionExtraSource,
} from "./transactionBlockMutations.js";
import {
  txBlockFlowMetadataFieldDefs,
  txBlockInteractionMetadataFieldDefs,
  txBlockPromptMetadataFieldDefs,
  txBlockRootMetadataFieldDefs,
  txBlockStepMetadataFieldDefs,
  txBlockWholeResourceMetadataFieldDefs,
} from "./transactionStructure.js";
import { txExtraStringFieldRows } from "./transactionMetadataFields.js";

const txPlainObject = plainObject;
const txStringValue = stringValue;
const txNullableNumberValue = nullableNumberValue;
const txJsonValueText = jsonValueText;

export const TX_BLOCK_OPERATION_KIND_ROWS = Object.freeze([
  "command",
  "flow",
  "template",
]);
export const TX_BLOCK_ROLLBACK_KIND_ROWS = Object.freeze([
  "none",
  "per_step",
  "whole_resource",
]);
export const TX_BLOCK_STEP_ROLLBACK_STATE_ROWS = Object.freeze([
  { value: "absent", labelKey: "txBlockRollbackStateAbsent" },
  { value: "null", labelKey: "txBlockRollbackStateNull" },
  { value: "operation", labelKey: "txBlockRollbackStateOperation" },
]);
export const TX_BLOCK_BOOLEAN_ROWS = Object.freeze(["true", "false"]);
export const TX_BLOCK_TEMPLATE_VAR_TYPE_ROWS = Object.freeze([
  "string",
  "secret",
  "number",
  "boolean",
  "json",
]);
export const TX_BLOCK_JSON_VALUE_TYPE_ROWS = Object.freeze([
  "string",
  "number",
  "boolean",
  "null",
  "json",
]);

const TX_COMMAND_DYN_PARAM_ENABLE_PASSWORD_KEYS = Object.freeze([
  "enable_password",
  "EnablePassword",
]);
const TX_COMMAND_DYN_PARAM_SUDO_PASSWORD_KEYS = Object.freeze([
  "sudo_password",
  "SudoPassword",
]);
const TX_COMMAND_DYN_PARAM_RESERVED_KEYS = new Set([
  ...TX_COMMAND_DYN_PARAM_ENABLE_PASSWORD_KEYS,
  ...TX_COMMAND_DYN_PARAM_SUDO_PASSWORD_KEYS,
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
    fieldKey: "rollbackState",
    labelKey: "txBlockFormStepRollbackField",
    optionKind: "rollbackState",
  },
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
  const placeholderText =
    txStringValue(commandModeState?.defaultMode).trim() ||
    t("txBlockFormModePlaceholder");
  return [
    {
      optionLabel: placeholderText,
      optionValue: "",
    },
    ...selectOptionsWithCurrent(modeOptions, selectedMode).map(
      (modeOption) => ({
        optionLabel: modeOption,
        optionValue: modeOption,
      }),
    ),
  ];
}

function txBlockStepRollbackState(step = {}) {
  if (!step.hasRollback) return "absent";
  return step.rollback ? "operation" : "null";
}

function txBlockCommandDynParamFieldValue(command = {}, aliases = []) {
  const dynParams = txPlainObject(command.dynParams) ? command.dynParams : {};
  for (const alias of aliases) {
    if (Object.hasOwn(dynParams, alias)) {
      return txJsonValueText(dynParams[alias]);
    }
  }
  return "";
}

function txBlockCommandDynParamFieldPresent(command = {}, aliases = []) {
  const dynParams = txPlainObject(command.dynParams) ? command.dynParams : {};
  return aliases.some((alias) => Object.hasOwn(dynParams, alias));
}

function txBlockCommandDynParamExtraRows(command = {}) {
  const dynParams = txPlainObject(command.dynParams) ? command.dynParams : {};
  return Object.entries(dynParams)
    .filter(([key]) => !TX_COMMAND_DYN_PARAM_RESERVED_KEYS.has(key))
    .map(([key, value]) => ({
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
) {
  const commandValue = txPlainObject(command) ? command : {};
  return TX_BLOCK_COMMAND_FIELD_DEFS.map((fieldDef) => {
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
}

export function txBlockFlowFieldsDisplay(flow = {}, booleanRows = []) {
  const flowValue = txPlainObject(flow) ? flow : {};
  return TX_BLOCK_FLOW_FIELD_DEFS.map((fieldDef) => {
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

export function txBlockWholeResourceFieldsDisplay(wholeResource = {}) {
  const wholeResourceValue = txPlainObject(wholeResource) ? wholeResource : {};
  return TX_BLOCK_WHOLE_RESOURCE_FIELD_DEFS.map((fieldDef) => ({
    ...fieldDef,
    enabled:
      !!wholeResourceValue.hasTriggerStepIndex ||
      wholeResourceValue[fieldDef.fieldKey] !== null,
    labelText: t(fieldDef.labelKey),
    placeholderText: fieldDef.placeholderKey ? t(fieldDef.placeholderKey) : "",
    showPresenceToggle: true,
    valueText:
      txNullableNumberValue(wholeResourceValue[fieldDef.fieldKey]) ?? "",
  }));
}

export function txBlockStepFieldsDisplay(step = {}) {
  const stepValue = txPlainObject(step) ? step : {};
  const rollbackStateValue = txBlockStepRollbackState(stepValue);
  return TX_BLOCK_STEP_FIELD_DEFS.map((fieldDef) => {
    if (fieldDef.optionKind === "rollbackState") {
      return {
        ...fieldDef,
        enabled: true,
        labelText: t(fieldDef.labelKey),
        optionRows: TX_BLOCK_STEP_ROLLBACK_STATE_ROWS.map((optionRow) => ({
          optionLabel: t(optionRow.labelKey),
          optionValue: optionRow.value,
        })),
        placeholderText: "",
        showPresenceToggle: false,
        valueText: rollbackStateValue,
      };
    }
    return {
      ...fieldDef,
      enabled:
        !!stepValue.hasRollbackOnFailure || !!stepValue.rollbackOnFailure,
      labelText: t(fieldDef.labelKey),
      optionRows: TX_BLOCK_BOOLEAN_ROWS.map((optionValue) => ({
        optionLabel: optionValue,
        optionValue,
      })),
      placeholderText: "",
      showPresenceToggle: true,
      valueText: stepValue.rollbackOnFailure ? "true" : "false",
    };
  });
}

export function txBlockRootPanelDisplay(model = {}, visualDisplay = {}) {
  const rootValue = txPlainObject(model) ? model : {};
  return {
    extraSource: txPlainObject(rootValue.extra) ? rootValue.extra : {},
    fieldRows: txBlockRootFieldsDisplay(
      rootValue,
      Array.isArray(visualDisplay.booleanRows) ? visualDisplay.booleanRows : [],
    ),
    metadataFieldRows: txExtraStringFieldRows(
      rootValue.extra,
      txBlockRootMetadataFieldDefs(),
    ),
  };
}

export function txBlockRollbackPolicyPanelDisplay(
  model = {},
  visualDisplay = {},
) {
  const rootValue = txPlainObject(model) ? model : {};
  const wholeResourcePolicy =
    rootValue.rollbackPolicy?.kind === "whole_resource"
      ? rootValue.rollbackPolicy?.wholeResource || null
      : null;
  return {
    metadataFieldRows: txExtraStringFieldRows(
      wholeResourcePolicy?.extra || {},
      txBlockWholeResourceMetadataFieldDefs(),
    ),
    rollbackKindValue: txStringValue(rootValue.rollbackPolicy?.kind, "none"),
    showWholeResource: rootValue.rollbackPolicy?.kind === "whole_resource",
    wholeResourceExtra: txPlainObject(wholeResourcePolicy?.extra)
      ? wholeResourcePolicy.extra
      : {},
    wholeResourceFieldRows: txBlockWholeResourceFieldsDisplay(
      wholeResourcePolicy || {},
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
) {
  return {
    dynParamEnablePasswordPresent: txBlockCommandDynParamFieldPresent(
      command,
      TX_COMMAND_DYN_PARAM_ENABLE_PASSWORD_KEYS,
    ),
    dynParamEnablePasswordValue: txBlockCommandDynParamFieldValue(
      command,
      TX_COMMAND_DYN_PARAM_ENABLE_PASSWORD_KEYS,
    ),
    dynParamExtraRows: txBlockCommandDynParamExtraRows(command),
    dynParamSudoPasswordPresent: txBlockCommandDynParamFieldPresent(
      command,
      TX_COMMAND_DYN_PARAM_SUDO_PASSWORD_KEYS,
    ),
    dynParamSudoPasswordValue: txBlockCommandDynParamFieldValue(
      command,
      TX_COMMAND_DYN_PARAM_SUDO_PASSWORD_KEYS,
    ),
    fieldRows: txBlockCommandFieldsDisplay(command, commandModeState),
    interactionDisplay: txBlockCommandInteractionDisplay(
      command,
      TX_BLOCK_BOOLEAN_ROWS,
    ),
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
  const dynParamEnablePasswordPresent =
    !!commandDisplayValue.dynParamEnablePasswordPresent;
  const dynParamSudoPasswordPresent =
    !!commandDisplayValue.dynParamSudoPasswordPresent;
  return {
    dynParamEnablePasswordPresent,
    dynParamEnablePasswordValue: txStringValue(
      commandDisplayValue.dynParamEnablePasswordValue,
    ),
    dynParamExtraRows,
    dynParamSudoPasswordPresent,
    dynParamSudoPasswordValue: txStringValue(
      commandDisplayValue.dynParamSudoPasswordValue,
    ),
    dynParamsPresent:
      !!commandValue.hasDynParams ||
      dynParamEnablePasswordPresent ||
      dynParamSudoPasswordPresent ||
      dynParamExtraRows.length > 0,
  };
}

export function txBlockInteractionMetadataFieldRows(command = {}) {
  return txExtraStringFieldRows(
    txInteractionExtraSource(command),
    txBlockInteractionMetadataFieldDefs(),
  );
}

export function txBlockFlowMetadataFieldRows(operation = {}) {
  return txExtraStringFieldRows(
    operation?.flow?.extra,
    txBlockFlowMetadataFieldDefs(),
  );
}

export function txBlockStepMetadataFieldRows(step = {}) {
  return txExtraStringFieldRows(step.extra, txBlockStepMetadataFieldDefs());
}

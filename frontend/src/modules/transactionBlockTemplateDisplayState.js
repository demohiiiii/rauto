import { visibleSavedConnectionNames } from "./connections.js";
import { getCachedDeviceProfiles } from "./templates.js";
import { t } from "../lib/i18n.js";
import {
  jsonValueText,
  jsonValueType,
  nullableNumberValue,
  plainObject,
  stringValue,
} from "../lib/jsonValue.js";
import { selectOptionsWithCurrent } from "../lib/ui.js";

const txPlainObject = plainObject;
const txStringValue = stringValue;
const txNullableNumberValue = nullableNumberValue;
const txJsonValueType = jsonValueType;
const txJsonValueText = jsonValueText;

const TX_BLOCK_TEMPLATE_VAR_FIELD_DEFS = Object.freeze([
  {
    controlType: "input",
    fieldKey: "name",
    inputType: "text",
    labelKey: "txBlockFormName",
    placeholderKey: "txBlockFormNamePlaceholder",
  },
  {
    controlType: "input",
    fieldKey: "label",
    inputType: "text",
    labelKey: "txBlockFormLabelPlaceholder",
    placeholderKey: "txBlockFormLabelPlaceholder",
    nullableMode: true,
  },
  {
    controlType: "select",
    fieldKey: "type",
    labelKey: "connectionVarTypeLabel",
    optionKind: "templateVarType",
  },
  {
    controlType: "input",
    fieldKey: "description",
    inputType: "text",
    labelKey: "txBlockFormDescriptionPlaceholder",
    placeholderKey: "txBlockFormDescriptionPlaceholder",
    nullableMode: true,
  },
  {
    controlType: "input",
    fieldKey: "placeholder",
    inputType: "text",
    labelKey: "txBlockFormPlaceholderPlaceholder",
    placeholderKey: "txBlockFormPlaceholderPlaceholder",
    nullableMode: true,
  },
  {
    controlType: "select",
    fieldKey: "required",
    labelKey: "requiredOption",
    optionKind: "boolean",
  },
]);

const TX_BLOCK_TEMPLATE_RUNTIME_FIELD_DEFS = Object.freeze([
  {
    controlType: "select",
    fieldKey: "defaultMode",
    labelKey: "txBlockFormRuntimeDefaultMode",
    optionKind: "profileMode",
    nullableMode: true,
  },
  {
    controlType: "select",
    fieldKey: "connectionName",
    labelKey: "txBlockFormConnectionName",
    optionKind: "savedConnection",
    nullableMode: true,
  },
  {
    controlType: "select",
    fieldKey: "deviceProfile",
    labelKey: "txBlockFormDeviceProfile",
    optionKind: "profile",
    nullableMode: true,
  },
  {
    controlType: "input",
    fieldKey: "host",
    inputType: "text",
    labelKey: "txBlockFormHost",
    placeholderKey: "txBlockFormHostPlaceholder",
    nullableMode: true,
  },
  {
    controlType: "input",
    fieldKey: "username",
    inputType: "text",
    labelKey: "txBlockFormUsername",
    placeholderKey: "txBlockFormUsernamePlaceholder",
    nullableMode: true,
  },
]);

const TX_BLOCK_TEMPLATE_DEFINITION_FIELD_DEFS = Object.freeze([
  {
    controlType: "input",
    fieldKey: "name",
    fieldScope: "template",
    inputType: "text",
    labelKey: "txBlockFormTemplateName",
  },
  {
    controlType: "select",
    fieldKey: "defaultMode",
    fieldScope: "template",
    labelKey: "txBlockFormDefaultMode",
    optionKind: "profileMode",
    nullableMode: true,
  },
  {
    controlType: "input",
    fieldKey: "description",
    fieldScope: "template",
    inputType: "text",
    labelKey: "txBlockFormDescription",
    nullableMode: true,
  },
  {
    controlType: "select",
    fieldKey: "stopOnError",
    fieldScope: "template",
    labelKey: "txBlockFormStopOnError",
    optionKind: "boolean",
  },
  {
    controlType: "input",
    fieldKey: "currentConnectionAlias",
    fieldScope: "operation",
    inputType: "text",
    labelKey: "txBlockFormCurrentConnectionAlias",
    placeholderKey: "txBlockFormCurrentConnectionAliasPlaceholder",
    nullableMode: true,
  },
]);

const TX_BLOCK_TEMPLATE_STEP_FIELD_DEFS = Object.freeze([
  {
    controlType: "input",
    fieldKey: "command",
    inputType: "text",
    labelKey: "txBlockFormCommand",
    placeholderKey: "txBlockFormCommandPlaceholder",
  },
  {
    controlType: "select",
    fieldKey: "mode",
    labelKey: "txBlockFormMode",
    optionKind: "profileMode",
    nullableMode: true,
  },
  {
    controlType: "input",
    fieldKey: "timeoutSecs",
    inputType: "number",
    labelKey: "txBlockFormTimeout",
    placeholderKey: "txBlockFormTimeoutSecsPlaceholder",
  },
]);

const TX_BLOCK_NULLABLE_MODE_ROWS = Object.freeze([
  { value: "value", labelKey: "txBlockNullableModeValue" },
  { value: "null", labelKey: "txBlockNullableModeNull" },
]);

function txObjectEntryRows(source = {}) {
  const value = txPlainObject(source) ? source : {};
  return Object.entries(value).map(([key, entryValue]) => ({
    keyText: String(key),
    typeValue: txJsonValueType(entryValue),
    valueText: txJsonValueText(entryValue),
  }));
}

function txStringListValue(source = []) {
  return Array.isArray(source)
    ? source.map((entryValue) => txJsonValueText(entryValue))
    : [];
}

function txBlockNullableModeRows() {
  return TX_BLOCK_NULLABLE_MODE_ROWS.map((optionRow) => ({
    optionLabel: t(optionRow.labelKey),
    optionValue: optionRow.value,
  }));
}

function txBlockNullableModeValue(sourceValue = {}, fieldKey = "") {
  return sourceValue?.[fieldKey] === null ? "null" : "value";
}

function txBlockWithNullableMode(
  fieldDef = {},
  sourceValue = {},
  fieldRow = {},
) {
  if (!fieldDef.nullableMode) return fieldRow;
  return {
    ...fieldRow,
    nullableModeRows: txBlockNullableModeRows(),
    nullableModeValue: txBlockNullableModeValue(sourceValue, fieldDef.fieldKey),
    showNullableModeSelect: !!fieldRow.enabled,
  };
}

function txBlockTemplateVarEditorRows(variable = {}) {
  return {
    fieldRows: txBlockTemplateVarFieldsDisplay(variable),
    defaultRows:
      variable.hasDefault || variable.defaultValue !== null
        ? [
            {
              typeValue: txJsonValueType(variable.defaultValue),
              valueText: txJsonValueText(variable.defaultValue),
            },
          ]
        : [],
    optionRows: txStringListValue(variable.options).map((valueText, index) => ({
      index,
      valueText,
    })),
  };
}

function txBlockTemplatePromptRows(prompt = {}) {
  return (Array.isArray(prompt.patterns) ? prompt.patterns : []).map(
    (pattern, index) => ({
      index,
      patternText: txStringValue(pattern),
    }),
  );
}

function txBlockTemplateStepRows(templateStep = {}) {
  const promptRows = (
    Array.isArray(templateStep.prompts) ? templateStep.prompts : []
  ).map((prompt, promptIndex) => ({
    patternRows: txBlockTemplatePromptRows(prompt),
    prompt,
    promptIndex,
  }));
  return {
    promptRows,
    promptsPresent: !!templateStep.hasPrompts || promptRows.length > 0,
  };
}

function txBlockTemplateRuntimeRows(runtime = {}) {
  return {
    varRows: txObjectEntryRows(runtime.vars),
  };
}

function txBlockTemplateRuntimeProfileOptionRows(currentValue = "") {
  const selectedProfile = txStringValue(currentValue).trim();
  return [
    {
      optionLabel: t("deviceProfilePlaceholder"),
      optionValue: "",
    },
    ...selectOptionsWithCurrent(getCachedDeviceProfiles(), selectedProfile).map(
      (deviceProfile) => ({
        optionLabel: deviceProfile,
        optionValue: deviceProfile,
      }),
    ),
  ];
}

function txBlockTemplateRuntimeSavedConnectionOptionRows(currentValue = "") {
  const selectedConnection = txStringValue(currentValue).trim();
  return [
    {
      optionLabel: t("savedConnSelectPlaceholder"),
      optionValue: "",
    },
    ...visibleSavedConnectionNames(selectedConnection).map(
      (connectionName) => ({
        optionLabel: connectionName,
        optionValue: connectionName,
      }),
    ),
  ];
}

function txBlockTemplateRuntimeModeOptionRows(
  currentValue = "",
  runtimeModeState = {},
) {
  const selectedMode = txStringValue(currentValue).trim();
  const modeOptions = Array.isArray(runtimeModeState?.modes)
    ? runtimeModeState.modes
    : [];
  const placeholderText =
    txStringValue(runtimeModeState?.defaultMode).trim() ||
    t("txBlockFormRuntimeDefaultModePlaceholder");
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

function txBlockTemplateDefinitionModeOptionRows(
  currentValue = "",
  templateModeState = {},
) {
  const selectedMode = txStringValue(currentValue).trim();
  const modeOptions = Array.isArray(templateModeState?.modes)
    ? templateModeState.modes
    : [];
  const placeholderText =
    txStringValue(templateModeState?.defaultMode).trim() ||
    t("modePlaceholder");
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

export function txBlockTemplateVarFieldsDisplay(
  variable = {},
  templateVarTypeRows = [],
) {
  const variableValue = txPlainObject(variable) ? variable : {};
  return TX_BLOCK_TEMPLATE_VAR_FIELD_DEFS.map((fieldDef) => {
    const presenceKey = `has${fieldDef.fieldKey[0].toUpperCase()}${fieldDef.fieldKey.slice(1)}`;
    const enabled =
      fieldDef.fieldKey === "name"
        ? true
        : fieldDef.fieldKey === "type"
          ? !!variableValue[presenceKey] || variableValue.type !== "string"
          : fieldDef.fieldKey === "required"
            ? !!variableValue[presenceKey] || !!variableValue.required
            : !!variableValue[presenceKey] ||
              variableValue[fieldDef.fieldKey] !== null;
    if (fieldDef.optionKind === "templateVarType") {
      return {
        ...fieldDef,
        enabled,
        labelText: t(fieldDef.labelKey),
        optionRows: selectOptionsWithCurrent(
          templateVarTypeRows,
          txStringValue(variableValue.type, "string"),
        ).map((optionValue) => ({
          optionLabel: optionValue,
          optionValue,
        })),
        placeholderText: "",
        showPresenceToggle: true,
        valueText: txStringValue(variableValue.type, "string"),
      };
    }
    if (fieldDef.optionKind === "boolean") {
      return {
        ...fieldDef,
        enabled,
        labelText: t(fieldDef.labelKey),
        optionRows: [
          { optionLabel: "true", optionValue: "true" },
          { optionLabel: "false", optionValue: "false" },
        ],
        placeholderText: "",
        showPresenceToggle: true,
        valueText: variableValue.required ? "true" : "false",
      };
    }
    return txBlockWithNullableMode(fieldDef, variableValue, {
      ...fieldDef,
      enabled,
      labelText: t(fieldDef.labelKey),
      placeholderText: fieldDef.placeholderKey
        ? t(fieldDef.placeholderKey)
        : "",
      showPresenceToggle: fieldDef.fieldKey !== "name",
      valueText: txStringValue(variableValue[fieldDef.fieldKey] ?? ""),
    });
  });
}

export function txBlockTemplateDefinitionFieldsDisplay(
  templateOperation = {},
  templateModeState = {},
) {
  const isWrappedTemplateOperation =
    txPlainObject(templateOperation) &&
    txPlainObject(templateOperation.template);
  const operationValue = txPlainObject(templateOperation)
    ? templateOperation
    : {};
  const templateValue = isWrappedTemplateOperation
    ? operationValue.template
    : operationValue;
  return TX_BLOCK_TEMPLATE_DEFINITION_FIELD_DEFS.map((fieldDef) => {
    const sourceValue =
      fieldDef.fieldScope === "operation" ? operationValue : templateValue;
    const valueText = txStringValue(sourceValue[fieldDef.fieldKey] ?? "");
    const presenceKey = `has${fieldDef.fieldKey[0].toUpperCase()}${fieldDef.fieldKey.slice(1)}`;
    const enabled =
      fieldDef.fieldKey === "name"
        ? true
        : !!sourceValue[presenceKey] || sourceValue[fieldDef.fieldKey] !== null;
    if (fieldDef.optionKind === "profileMode") {
      return txBlockWithNullableMode(fieldDef, sourceValue, {
        ...fieldDef,
        enabled,
        labelText: t(fieldDef.labelKey),
        optionRows: txBlockTemplateDefinitionModeOptionRows(
          valueText,
          templateModeState,
        ),
        placeholderText: "",
        showPresenceToggle: true,
        valueText,
      });
    }
    if (fieldDef.optionKind === "boolean") {
      return {
        ...fieldDef,
        enabled,
        labelText: t(fieldDef.labelKey),
        optionRows: [
          { optionLabel: "true", optionValue: "true" },
          { optionLabel: "false", optionValue: "false" },
        ],
        placeholderText: "",
        showPresenceToggle: true,
        valueText: templateValue[fieldDef.fieldKey] ? "true" : "false",
      };
    }
    return txBlockWithNullableMode(fieldDef, sourceValue, {
      ...fieldDef,
      enabled,
      labelText: t(fieldDef.labelKey),
      placeholderText: fieldDef.placeholderKey
        ? t(fieldDef.placeholderKey)
        : "",
      showPresenceToggle: fieldDef.fieldKey !== "name",
      valueText,
    });
  });
}

export function txBlockTemplateRuntimeFieldsDisplay(
  runtime = {},
  runtimeModeState = {},
) {
  const runtimeValue = txPlainObject(runtime) ? runtime : {};
  return TX_BLOCK_TEMPLATE_RUNTIME_FIELD_DEFS.map((fieldDef) => {
    const valueText = txStringValue(runtimeValue[fieldDef.fieldKey] ?? "");
    const presenceKey = `has${fieldDef.fieldKey[0].toUpperCase()}${fieldDef.fieldKey.slice(1)}`;
    const enabled =
      !!runtimeValue[presenceKey] || runtimeValue[fieldDef.fieldKey] !== null;
    if (fieldDef.optionKind === "profile") {
      return txBlockWithNullableMode(fieldDef, runtimeValue, {
        ...fieldDef,
        enabled,
        labelText: t(fieldDef.labelKey),
        optionRows: txBlockTemplateRuntimeProfileOptionRows(valueText),
        placeholderText: "",
        valueText,
      });
    }
    if (fieldDef.optionKind === "profileMode") {
      return txBlockWithNullableMode(fieldDef, runtimeValue, {
        ...fieldDef,
        enabled,
        labelText: t(fieldDef.labelKey),
        optionRows: txBlockTemplateRuntimeModeOptionRows(
          valueText,
          runtimeModeState,
        ),
        placeholderText: "",
        valueText,
      });
    }
    if (fieldDef.optionKind === "savedConnection") {
      return txBlockWithNullableMode(fieldDef, runtimeValue, {
        ...fieldDef,
        enabled,
        labelText: t(fieldDef.labelKey),
        optionRows: txBlockTemplateRuntimeSavedConnectionOptionRows(valueText),
        placeholderText: "",
        valueText,
      });
    }
    return txBlockWithNullableMode(fieldDef, runtimeValue, {
      ...fieldDef,
      enabled,
      labelText: t(fieldDef.labelKey),
      placeholderText: fieldDef.placeholderKey
        ? t(fieldDef.placeholderKey)
        : "",
      valueText,
    });
  });
}

export function txBlockTemplateStepFieldsDisplay(
  templateStep = {},
  templateModeState = {},
) {
  const stepValue = txPlainObject(templateStep) ? templateStep : {};
  return TX_BLOCK_TEMPLATE_STEP_FIELD_DEFS.map((fieldDef) => {
    const presenceKey = `has${fieldDef.fieldKey[0].toUpperCase()}${fieldDef.fieldKey.slice(1)}`;
    const enabled =
      fieldDef.fieldKey === "command"
        ? true
        : !!stepValue[presenceKey] || stepValue[fieldDef.fieldKey] !== null;
    const valueText =
      fieldDef.inputType === "number"
        ? (txNullableNumberValue(stepValue[fieldDef.fieldKey]) ?? "")
        : txStringValue(stepValue[fieldDef.fieldKey] ?? "");
    if (fieldDef.optionKind === "profileMode") {
      return txBlockWithNullableMode(fieldDef, stepValue, {
        ...fieldDef,
        enabled,
        labelText: t(fieldDef.labelKey),
        optionRows: txBlockTemplateDefinitionModeOptionRows(
          txStringValue(stepValue[fieldDef.fieldKey] ?? ""),
          templateModeState,
        ),
        placeholderText: "",
        showPresenceToggle: true,
        valueText,
      });
    }
    return txBlockWithNullableMode(fieldDef, stepValue, {
      ...fieldDef,
      enabled,
      labelText: t(fieldDef.labelKey),
      placeholderText: fieldDef.placeholderKey
        ? t(fieldDef.placeholderKey)
        : "",
      showPresenceToggle: fieldDef.fieldKey !== "command",
      valueText,
    });
  });
}

export function txBlockTemplateEditorDisplay(templateOperation = {}) {
  const template = templateOperation.template || {};
  const runtime = templateOperation.runtime || {};
  const runtimeFieldRows = txBlockTemplateRuntimeFieldsDisplay(runtime);
  const runtimeRowState = txBlockTemplateRuntimeRows(runtime);
  return {
    runtimeFieldRows,
    runtime: {
      ...runtimeRowState,
      present:
        !!templateOperation.hasRuntime ||
        runtimeFieldRows.some((fieldRow) => fieldRow.enabled) ||
        runtimeRowState.varRows.length > 0 ||
        Object.keys(txPlainObject(runtime.extra) ? runtime.extra : {}).length >
          0,
    },
    stepRows: (Array.isArray(template.steps) ? template.steps : []).map(
      (step, stepIndex) => ({
        ...txBlockTemplateStepRows(step),
        step,
        stepIndex,
      }),
    ),
    varRows: (Array.isArray(template.vars) ? template.vars : []).map(
      (variable, varIndex) => ({
        ...txBlockTemplateVarEditorRows(variable),
        varIndex,
        variable,
      }),
    ),
  };
}

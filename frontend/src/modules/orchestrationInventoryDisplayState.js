import { t } from "../lib/i18n.js";
import { selectOptionsWithCurrent } from "../lib/ui.js";
import { cloneJsonValue, plainObject, stringValue } from "../lib/jsonValue.js";
import { visibleSavedConnectionNames } from "./connections.js";
import { getCachedDeviceProfiles } from "./templates.js";
import {
  orchestrationTargetDefaultsModelFromJson,
  orchestrationTargetModelFromJson,
} from "./orchestrationFormState.js";

const cloneOrchestrationJsonValue = cloneJsonValue;
const orchestrationPlainObject = plainObject;
const orchestrationStringValue = stringValue;

export const ORCHESTRATION_CONNECTION_NULLABLE_FIELD_KEYS = new Set([
  "name",
  "connection",
  "host",
  "username",
  "password",
  "enablePassword",
  "sshSecurity",
  "linuxShellFlavor",
  "deviceProfile",
  "templateDir",
]);

export const ORCHESTRATION_DEFAULTS_FIELD_DEFS = Object.freeze([
  {
    fieldKey: "username",
    labelKey: "fieldUsername",
    controlType: "input",
    inputType: "text",
  },
  {
    fieldKey: "password",
    labelKey: "fieldPassword",
    controlType: "input",
    inputType: "password",
  },
  {
    fieldKey: "port",
    labelKey: "fieldPort",
    controlType: "input",
    inputType: "number",
  },
  {
    fieldKey: "enablePassword",
    labelKey: "fieldEnablePassword",
    controlType: "input",
    inputType: "password",
  },
  {
    fieldKey: "sshSecurity",
    labelKey: "fieldSshSecurity",
    controlType: "select",
    optionDefs: [
      ["", "sshSecurityOptionDefault"],
      ["secure", "sshSecurityOptionSecure"],
      ["balanced", "sshSecurityOptionBalanced"],
      ["legacy-compatible", "sshSecurityOptionLegacy"],
    ],
  },
  {
    fieldKey: "linuxShellFlavor",
    labelKey: "fieldLinuxShellFlavor",
    controlType: "select",
    optionDefs: [
      ["", "linuxShellOptionDefault"],
      ["posix", "linuxShellOptionPosix"],
      ["fish", "linuxShellOptionFish"],
    ],
  },
  {
    fieldKey: "deviceProfile",
    labelKey: "fieldProfile",
    controlType: "select",
    optionKind: "profile",
  },
  {
    fieldKey: "templateDir",
    labelKey: "orchestrationFormTemplateDir",
    controlType: "input",
    inputType: "text",
  },
]);

export const ORCHESTRATION_TARGET_DETAIL_FIELD_DEFS = Object.freeze([
  {
    fieldKey: "name",
    labelKey: "inventoryFieldName",
    controlType: "input",
    inputType: "text",
  },
  {
    fieldKey: "connection",
    labelKey: "fieldConnection",
    controlType: "select",
    optionKind: "savedConnection",
  },
  ...ORCHESTRATION_DEFAULTS_FIELD_DEFS,
]);

function orchestrationOptionRows(optionDefs = []) {
  return optionDefs.map(([optionValue, labelKey]) => ({
    optionLabel: t(labelKey),
    optionValue,
  }));
}

function orchestrationProfileOptionRows(currentValue = "") {
  const selectedProfile = orchestrationStringValue(currentValue).trim();
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

function orchestrationSavedConnectionOptionRows(currentValue = "") {
  return [
    {
      optionLabel: t("savedConnSelectPlaceholder"),
      optionValue: "",
    },
    ...visibleSavedConnectionNames(currentValue).map((connectionName) => ({
      optionLabel: connectionName,
      optionValue: connectionName,
    })),
  ];
}

function orchestrationNullableModeRows() {
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

function orchestrationJsonFieldText(jsonValue = {}, fallback = {}) {
  return JSON.stringify(
    cloneOrchestrationJsonValue(jsonValue, fallback),
    null,
    2,
  );
}

function orchestrationConnectionFieldRows(fieldValues = {}, fieldDefs = []) {
  const values =
    fieldValues && typeof fieldValues === "object" ? fieldValues : {};
  return fieldDefs.map((fieldDef) => {
    const valueText = orchestrationStringValue(values[fieldDef.fieldKey] ?? "");
    const supportsNullableMode =
      ORCHESTRATION_CONNECTION_NULLABLE_FIELD_KEYS.has(fieldDef.fieldKey);
    const nullableModeRows = supportsNullableMode
      ? orchestrationNullableModeRows()
      : [];
    const nullableModeValue =
      supportsNullableMode && values[fieldDef.fieldKey] === null
        ? "null"
        : "value";
    if (
      fieldDef.controlType === "select" &&
      fieldDef.optionKind === "profile"
    ) {
      return {
        ...fieldDef,
        nullableModeRows,
        nullableModeValue,
        optionRows: orchestrationProfileOptionRows(valueText),
        supportsNullableMode,
        valueText,
      };
    }
    if (
      fieldDef.controlType === "select" &&
      fieldDef.optionKind === "savedConnection"
    ) {
      return {
        ...fieldDef,
        nullableModeRows,
        nullableModeValue,
        optionRows: orchestrationSavedConnectionOptionRows(valueText),
        supportsNullableMode,
        valueText,
      };
    }
    if (fieldDef.controlType === "select" && fieldDef.optionDefs) {
      return {
        ...fieldDef,
        nullableModeRows,
        nullableModeValue,
        optionRows: orchestrationOptionRows(fieldDef.optionDefs),
        supportsNullableMode,
        valueText,
      };
    }
    return {
      ...fieldDef,
      nullableModeRows,
      nullableModeValue,
      supportsNullableMode,
      valueText,
    };
  });
}

function orchestrationDefaultTargetDefaultsModel() {
  return orchestrationTargetDefaultsModelFromJson({});
}

function orchestrationDefaultTargetModel() {
  return orchestrationTargetModelFromJson({});
}

export function orchestrationTargetRows(targets = [], stageIndex, jobIndex) {
  return (Array.isArray(targets) ? targets : []).map((target, targetIndex) => ({
    target,
    targetConnectionOptionRows: orchestrationSavedConnectionOptionRows(
      target?.connection || "",
    ),
    targetDetail: target?.target || orchestrationDefaultTargetModel(),
    targetFieldRows: orchestrationConnectionFieldRows(
      target?.target || orchestrationDefaultTargetModel(),
      ORCHESTRATION_TARGET_DETAIL_FIELD_DEFS,
    ),
    varsText: orchestrationJsonFieldText(target?.target?.vars, {}),
    targetIndex,
    stageIndex,
    jobIndex,
  }));
}

function orchestrationInventoryDefaultsFieldRows(defaults = {}) {
  return orchestrationConnectionFieldRows(
    defaults && typeof defaults === "object"
      ? defaults
      : orchestrationDefaultTargetDefaultsModel(),
    ORCHESTRATION_DEFAULTS_FIELD_DEFS,
  );
}

function orchestrationInventoryGroupTargetsText(targets = []) {
  return (Array.isArray(targets) ? targets : [])
    .map((target) =>
      typeof target === "string"
        ? target.trim()
        : orchestrationStringValue(
            target?.connection || target?.name || "",
          ).trim(),
    )
    .filter(Boolean)
    .join("\n");
}

function orchestrationInventoryGroupDisplay(group = {}, groupIndex = 0) {
  const defaults = group.defaults || null;
  return {
    group,
    groupIndex,
    titleText: `${t("orchestrationFormInventoryGroup")} ${groupIndex + 1}`,
    nameValue: orchestrationStringValue(group.name),
    useDetailed: !!group.useDetailed,
    defaultsFieldRows: orchestrationInventoryDefaultsFieldRows(defaults || {}),
    defaultsVarsText: orchestrationJsonFieldText(defaults?.vars, {}),
    simpleTargetRows: (Array.isArray(group.targets) ? group.targets : []).map(
      (itemValue, itemIndex) => ({
        itemIndex,
        text:
          typeof itemValue === "string"
            ? itemValue
            : orchestrationStringValue(
                itemValue?.connection || itemValue?.name || "",
              ),
      }),
    ),
    targetsText: orchestrationInventoryGroupTargetsText(group.targets),
    targetRows: (Array.isArray(group.targets) ? group.targets : []).map(
      (target, targetIndex) => ({
        target,
        targetConnectionOptionRows: orchestrationSavedConnectionOptionRows(
          target?.connection || "",
        ),
        targetDetail: target?.target || orchestrationDefaultTargetModel(),
        targetFieldRows: orchestrationConnectionFieldRows(
          target?.target || orchestrationDefaultTargetModel(),
          ORCHESTRATION_TARGET_DETAIL_FIELD_DEFS,
        ),
        varsText: orchestrationJsonFieldText(target?.target?.vars, {}),
        targetIndex,
      }),
    ),
  };
}

export function orchestrationInventoryEditorDisplay(model = {}) {
  const inventory = orchestrationPlainObject(model) ? model : {};
  return {
    booleanRows: ["true", "false"],
    jsonValueTypeRows: ["string", "number", "boolean", "null", "json"],
    targetInputKindRows: ["connection", "detailed"],
    defaultsFieldRows: orchestrationInventoryDefaultsFieldRows(
      inventory.defaults || {},
    ),
    defaultsVarsText: orchestrationJsonFieldText(inventory.defaults?.vars, {}),
    groupRows: (Array.isArray(inventory.groups) ? inventory.groups : []).map(
      (group, groupIndex) =>
        orchestrationInventoryGroupDisplay(group, groupIndex),
    ),
  };
}

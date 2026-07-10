import { t } from "../lib/i18n.js";
import { plainObject, stringValue } from "../lib/jsonValue.js";
import { txExtraStringFieldRows } from "./transactionMetadataFields.js";
import {
  ORCHESTRATION_INVENTORY_DEFAULTS_METADATA_FIELD_DEFS,
  ORCHESTRATION_INVENTORY_GROUP_DEFAULTS_METADATA_FIELD_DEFS,
  ORCHESTRATION_INVENTORY_GROUP_METADATA_FIELD_DEFS,
  ORCHESTRATION_JOB_METADATA_FIELD_DEFS,
  ORCHESTRATION_PLAN_METADATA_FIELD_DEFS,
  ORCHESTRATION_STAGE_METADATA_FIELD_DEFS,
  ORCHESTRATION_TARGET_METADATA_FIELD_DEFS,
  orchestrationFieldEnabled,
  orchestrationFieldSupportsNullableMode,
  orchestrationJobFieldsDisplay,
  orchestrationNullableModeRows,
  orchestrationObjectEnabled,
  orchestrationRootFieldsDisplay,
  orchestrationStageFieldsDisplay,
  orchestrationTextListRows,
} from "./orchestrationFormFieldState.js";

const orchestrationPlainObject = plainObject;
const orchestrationStringValue = stringValue;

export * from "./orchestrationFormFieldState.js";

function orchestrationStringItemRows(listEntries = []) {
  return (Array.isArray(listEntries) ? listEntries : []).map(
    (itemValue, itemIndex) => ({
      itemIndex,
      text:
        typeof itemValue === "string"
          ? itemValue
          : orchestrationStringValue(
              itemValue?.connection || itemValue?.name || "",
            ),
    }),
  );
}

export function orchestrationPlanSettingsPanelDisplay(
  model = {},
  visualDisplay = {},
) {
  const planValue = orchestrationPlainObject(model) ? model : {};
  return {
    extraField: {
      source: orchestrationPlainObject(planValue.extra) ? planValue.extra : {},
      titleText: t("orchestrationFormPlanExtra"),
      typeRows: Array.isArray(visualDisplay.jsonValueTypeRows)
        ? visualDisplay.jsonValueTypeRows
        : [],
    },
    metadataFieldRows: txExtraStringFieldRows(
      planValue.extra,
      ORCHESTRATION_PLAN_METADATA_FIELD_DEFS,
    ),
    rootFieldRows: orchestrationRootFieldsDisplay(
      planValue,
      Array.isArray(visualDisplay.booleanRows) ? visualDisplay.booleanRows : [],
    ),
  };
}

export function orchestrationJobEditorDisplay(jobRow = {}) {
  return {
    removeButtonLabel: t("deleteBtn"),
    titleText:
      orchestrationStringValue(jobRow.titleText) ||
      `${t("orchestrationFormJob")} ${(jobRow.jobIndex ?? 0) + 1}`,
  };
}

export function orchestrationStageSettingsPanelDisplay(
  stageRow = {},
  visualDisplay = {},
) {
  const stageValue = orchestrationPlainObject(stageRow.stage)
    ? stageRow.stage
    : {};
  return {
    extraField: {
      source: orchestrationPlainObject(stageValue.extra)
        ? stageValue.extra
        : {},
      titleText: t("orchestrationFormStageExtra"),
      typeRows: Array.isArray(visualDisplay.jsonValueTypeRows)
        ? visualDisplay.jsonValueTypeRows
        : [],
    },
    fieldRows: orchestrationStageFieldsDisplay(
      stageValue,
      Array.isArray(visualDisplay.strategyRows)
        ? visualDisplay.strategyRows
        : [],
      Array.isArray(visualDisplay.booleanRows) ? visualDisplay.booleanRows : [],
    ),
    metadataFieldRows: txExtraStringFieldRows(
      stageValue.extra,
      ORCHESTRATION_STAGE_METADATA_FIELD_DEFS,
    ),
  };
}

export function orchestrationJobSettingsPanelDisplay(
  job = {},
  visualDisplay = {},
) {
  const jobValue = orchestrationPlainObject(job) ? job : {};
  return {
    extraField: {
      source: orchestrationPlainObject(jobValue.extra) ? jobValue.extra : {},
      titleText: t("orchestrationFormJobExtra"),
      typeRows: Array.isArray(visualDisplay.jsonValueTypeRows)
        ? visualDisplay.jsonValueTypeRows
        : [],
    },
    fieldRows: orchestrationJobFieldsDisplay(
      jobValue,
      Array.isArray(visualDisplay.strategyRows)
        ? visualDisplay.strategyRows
        : [],
      Array.isArray(visualDisplay.booleanRows) ? visualDisplay.booleanRows : [],
    ),
    metadataFieldRows: txExtraStringFieldRows(
      jobValue.extra,
      ORCHESTRATION_JOB_METADATA_FIELD_DEFS,
    ),
  };
}

export function orchestrationTargetInputDisplay(
  targetRow = {},
  {
    titleText = "",
    targetInputKindRows = [],
    jsonValueTypeRows = [],
    showFieldPresenceToggle = false,
    showVarsPresenceToggle = false,
  } = {},
) {
  const target = orchestrationPlainObject(targetRow.target)
    ? targetRow.target
    : {};
  const targetDetail = orchestrationPlainObject(targetRow.targetDetail)
    ? targetRow.targetDetail
    : {};
  const targetFieldRows = Array.isArray(targetRow.targetFieldRows)
    ? targetRow.targetFieldRows
    : [];
  const kindValue = orchestrationStringValue(target.kind) || "connection";
  return {
    connectionField: {
      labelText: t("fieldConnection"),
      optionRows: Array.isArray(targetRow.targetConnectionOptionRows)
        ? targetRow.targetConnectionOptionRows
        : [],
      valueText: orchestrationStringValue(target.connection),
    },
    extraField: {
      source: orchestrationPlainObject(targetDetail.extra)
        ? targetDetail.extra
        : {},
      titleText: t("orchestrationFormTargetExtra"),
      typeRows: Array.isArray(jsonValueTypeRows) ? jsonValueTypeRows : [],
    },
    metadataFieldRows: txExtraStringFieldRows(
      targetDetail.extra,
      ORCHESTRATION_TARGET_METADATA_FIELD_DEFS,
    ),
    fieldRows: targetFieldRows.map((fieldRow) => ({
      ...fieldRow,
      enabled: showFieldPresenceToggle
        ? orchestrationFieldEnabled(targetDetail, fieldRow.fieldKey)
        : true,
      labelText: t(fieldRow.labelKey),
      nullableModeRows: orchestrationFieldSupportsNullableMode(fieldRow)
        ? orchestrationNullableModeRows()
        : fieldRow.nullableModeRows,
      nullableModeValue: orchestrationFieldSupportsNullableMode(fieldRow)
        ? targetDetail?.[fieldRow.fieldKey] === null
          ? "null"
          : "value"
        : fieldRow.nullableModeValue,
      showNullableModeSelect:
        !!showFieldPresenceToggle &&
        orchestrationFieldSupportsNullableMode(fieldRow) &&
        (showFieldPresenceToggle
          ? orchestrationFieldEnabled(targetDetail, fieldRow.fieldKey)
          : true),
      showPresenceToggle: !!showFieldPresenceToggle,
    })),
    kindField: {
      labelText: t("orchestrationFormTargetKind"),
      optionRows: (Array.isArray(targetInputKindRows)
        ? targetInputKindRows
        : []
      ).map((optionValue) => ({
        optionLabel: optionValue,
        optionValue,
      })),
      valueText: kindValue,
    },
    removeButtonLabel: t("deleteBtn"),
    showConnectionField: kindValue === "connection",
    showDetailedFields: kindValue !== "connection",
    titleText,
    varsField: {
      enabled: showVarsPresenceToggle
        ? orchestrationObjectEnabled(targetDetail, "vars")
        : true,
      labelText: t("orchestrationFormVars"),
      source: orchestrationPlainObject(targetDetail.vars)
        ? targetDetail.vars
        : {},
      showPresenceToggle: !!showVarsPresenceToggle,
      valueText: orchestrationStringValue(targetRow.varsText || "{}"),
    },
  };
}

export function orchestrationInventoryDefaultsSectionDisplay({
  defaultsModel = {},
  defaultsFieldRows = [],
  defaultsVarsText = "{}",
  jsonValueTypeRows = [],
} = {}) {
  const model = orchestrationPlainObject(defaultsModel) ? defaultsModel : {};
  return {
    extraField: {
      source: orchestrationPlainObject(model.extra) ? model.extra : {},
      titleText: t("orchestrationFormInventoryDefaultsExtra"),
      typeRows: Array.isArray(jsonValueTypeRows) ? jsonValueTypeRows : [],
    },
    metadataFieldRows: txExtraStringFieldRows(
      model.extra,
      ORCHESTRATION_INVENTORY_DEFAULTS_METADATA_FIELD_DEFS,
    ),
    fieldRows: (Array.isArray(defaultsFieldRows) ? defaultsFieldRows : []).map(
      (fieldRow) => ({
        ...fieldRow,
        enabled: orchestrationFieldEnabled(model, fieldRow.fieldKey),
        nullableModeRows: orchestrationFieldSupportsNullableMode(fieldRow)
          ? orchestrationNullableModeRows()
          : fieldRow.nullableModeRows,
        nullableModeValue: orchestrationFieldSupportsNullableMode(fieldRow)
          ? model?.[fieldRow.fieldKey] === null
            ? "null"
            : "value"
          : fieldRow.nullableModeValue,
        showNullableModeSelect:
          orchestrationFieldSupportsNullableMode(fieldRow) &&
          orchestrationFieldEnabled(model, fieldRow.fieldKey),
        showPresenceToggle: true,
      }),
    ),
    varsField: {
      enabled: orchestrationObjectEnabled(model, "vars"),
      labelText: t("orchestrationFormVars"),
      source: orchestrationPlainObject(model.vars) ? model.vars : {},
      showPresenceToggle: true,
      valueText: orchestrationStringValue(defaultsVarsText || "{}"),
    },
  };
}

export function orchestrationInventoryGroupSettingsDisplay(
  groupRow = {},
  { jsonValueTypeRows = [] } = {},
) {
  const group = orchestrationPlainObject(groupRow.group) ? groupRow.group : {};
  const defaults = orchestrationPlainObject(group.defaults)
    ? group.defaults
    : {};
  return {
    defaultsExtraField: {
      source: orchestrationPlainObject(defaults.extra) ? defaults.extra : {},
      titleText: t("orchestrationFormInventoryGroupDefaultsExtra"),
      typeRows: Array.isArray(jsonValueTypeRows) ? jsonValueTypeRows : [],
    },
    defaultsMetadataFieldRows: txExtraStringFieldRows(
      defaults.extra,
      ORCHESTRATION_INVENTORY_GROUP_DEFAULTS_METADATA_FIELD_DEFS,
    ),
    defaultsFieldRows: (Array.isArray(groupRow.defaultsFieldRows)
      ? groupRow.defaultsFieldRows
      : []
    ).map((fieldRow) => ({
      ...fieldRow,
      enabled: orchestrationFieldEnabled(defaults, fieldRow.fieldKey),
      nullableModeRows: orchestrationFieldSupportsNullableMode(fieldRow)
        ? orchestrationNullableModeRows()
        : fieldRow.nullableModeRows,
      nullableModeValue: orchestrationFieldSupportsNullableMode(fieldRow)
        ? defaults?.[fieldRow.fieldKey] === null
          ? "null"
          : "value"
        : fieldRow.nullableModeValue,
      showNullableModeSelect:
        orchestrationFieldSupportsNullableMode(fieldRow) &&
        orchestrationFieldEnabled(defaults, fieldRow.fieldKey),
      showPresenceToggle: true,
    })),
    defaultsVarsField: {
      enabled: orchestrationObjectEnabled(defaults, "vars"),
      labelText: t("orchestrationFormVars"),
      source: orchestrationPlainObject(defaults.vars) ? defaults.vars : {},
      showPresenceToggle: true,
      valueText: orchestrationStringValue(groupRow.defaultsVarsText || "{}"),
    },
    groupExtraField: {
      source: orchestrationPlainObject(group.extra) ? group.extra : {},
      titleText: t("orchestrationFormInventoryGroupExtra"),
      typeRows: Array.isArray(jsonValueTypeRows) ? jsonValueTypeRows : [],
    },
    groupMetadataFieldRows: txExtraStringFieldRows(
      group.extra,
      ORCHESTRATION_INVENTORY_GROUP_METADATA_FIELD_DEFS,
    ),
    nameField: {
      labelText: t("orchestrationFormGroupName"),
      valueText: orchestrationStringValue(groupRow.nameValue),
    },
    useDetailedChecked: !!groupRow.useDetailed,
    useDetailedLabelText: t("orchestrationFormDetailedGroup"),
  };
}

export function orchestrationInventoryGroupTargetsDisplay(
  groupRow = {},
  {
    addButtonLabelText = "",
    placeholderText = "",
    removeButtonLabelText = "",
    targetLabelText = "",
  } = {},
) {
  const group = orchestrationPlainObject(groupRow.group) ? groupRow.group : {};
  return {
    addButtonLabelText,
    placeholderText,
    removeButtonLabelText,
    showDetailedTargets: !!groupRow.useDetailed,
    simpleTargetRows:
      Array.isArray(groupRow.simpleTargetRows) &&
      groupRow.simpleTargetRows.length
        ? groupRow.simpleTargetRows
        : orchestrationStringItemRows(group.targets),
    targetLabelText,
    targetsEnabled:
      !!group.hasTargets ||
      (Array.isArray(group.targets) && group.targets.length > 0),
  };
}

export function orchestrationJobTargetsDisplay(
  jobRow = {},
  {
    addTargetLabelText = "",
    addValueLabelText = "",
    deleteLabelText = "",
    targetGroupLabelText = "",
    targetTagLabelText = "",
    targetLabelText = "",
  } = {},
) {
  const job = orchestrationPlainObject(jobRow.job) ? jobRow.job : {};
  return {
    targetGroupsField: {
      addButtonLabelText: addValueLabelText,
      enabled:
        !!job.hasTargetGroups ||
        (Array.isArray(job.targetGroups) && job.targetGroups.length > 0),
      itemRows: Array.isArray(jobRow.targetGroupRows)
        ? jobRow.targetGroupRows
        : orchestrationTextListRows(job.targetGroups),
      labelText: targetGroupLabelText,
      placeholderText: targetGroupLabelText,
      removeButtonLabelText: deleteLabelText,
    },
    targetTagsField: {
      addButtonLabelText: addValueLabelText,
      enabled:
        !!job.hasTargetTags ||
        (Array.isArray(job.targetTags) && job.targetTags.length > 0),
      itemRows: Array.isArray(jobRow.targetTagRows)
        ? jobRow.targetTagRows
        : orchestrationTextListRows(job.targetTags),
      labelText: targetTagLabelText,
      placeholderText: targetTagLabelText,
      removeButtonLabelText: deleteLabelText,
    },
    targetsField: {
      addButtonLabelText: addTargetLabelText,
      enabled:
        !!job.hasTargets ||
        (Array.isArray(job.targets) && job.targets.length > 0),
      labelText: targetLabelText,
      targetRows: Array.isArray(jobRow.targetRows) ? jobRow.targetRows : [],
      targetTitleText: (targetIndex = 0) =>
        `${targetLabelText} ${targetIndex + 1}`,
    },
  };
}

export function orchestrationInventoryPanelDisplay(
  model = {},
  inventoryDisplay = {},
) {
  const enabled = !!model.inventory;
  const groupRows = Array.isArray(inventoryDisplay.groupRows)
    ? inventoryDisplay.groupRows
    : [];
  return {
    addGroupButtonLabel: t("orchestrationFormAddGroup"),
    enabled,
    enableLabelText: t("orchestrationFormEnableInventory"),
    groupRows,
    groupSectionTitle: t("orchestrationFormInventoryGroup"),
    showGroupEmpty: enabled && groupRows.length === 0,
    showGroupSection: enabled,
    titleText: t("orchestrationFormInventory"),
  };
}

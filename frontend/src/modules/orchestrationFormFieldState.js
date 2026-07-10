import { t } from "../lib/i18n.js";
import { selectOptionsWithCurrent } from "../lib/ui.js";
import {
  cloneJsonValue,
  nullableNumberValue,
  plainObject,
  stringValue,
} from "../lib/jsonValue.js";
import { txStructureMappingEntry } from "./transactionStructure.js";
import {
  ORCHESTRATION_DEFAULTS_FIELD_DEFS,
  ORCHESTRATION_TARGET_DETAIL_FIELD_DEFS,
} from "./orchestrationInventoryState.js";

const orchestrationPlainObject = plainObject;
const orchestrationStringValue = stringValue;
const orchestrationNullableNumberValue = nullableNumberValue;
const orchestrationCloneJsonValue = cloneJsonValue;

let ORCHESTRATION_JSON_STRUCTURE_MAPPING = null;

const ORCHESTRATION_ROOT_FIELD_DEFS = Object.freeze([
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
  {
    controlType: "input",
    fieldKey: "inventoryFile",
    inputType: "text",
    labelKey: "orchestrationFormInventoryFile",
  },
]);

const ORCHESTRATION_STAGE_FIELD_DEFS = Object.freeze([
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

const ORCHESTRATION_JOB_FIELD_DEFS = Object.freeze([
  {
    controlType: "input",
    fieldKey: "name",
    inputType: "text",
    labelKey: "orchestrationFormJob",
  },
  ...ORCHESTRATION_STAGE_FIELD_DEFS.slice(1),
]);

export const ORCHESTRATION_PLAN_METADATA_FIELD_DEFS = Object.freeze([
  {
    fieldKey: "plan_label",
    labelKey: "orchestrationFormPlanLabel",
    placeholderKey: "txBlockFormLabelPlaceholder",
  },
]);

export const ORCHESTRATION_STAGE_METADATA_FIELD_DEFS = Object.freeze([
  {
    fieldKey: "stage_label",
    labelKey: "orchestrationFormStageLabel",
    placeholderKey: "txBlockFormLabelPlaceholder",
  },
]);

export const ORCHESTRATION_JOB_METADATA_FIELD_DEFS = Object.freeze([
  {
    fieldKey: "job_label",
    labelKey: "orchestrationFormJobLabel",
    placeholderKey: "txBlockFormLabelPlaceholder",
  },
]);

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

export const ORCHESTRATION_INVENTORY_DEFAULTS_METADATA_FIELD_DEFS =
  Object.freeze([
    {
      fieldKey: "defaults_label",
      labelKey: "orchestrationFormInventoryDefaultsLabel",
      placeholderKey: "txBlockFormLabelPlaceholder",
    },
  ]);

export const ORCHESTRATION_INVENTORY_GROUP_DEFAULTS_METADATA_FIELD_DEFS =
  Object.freeze([
    {
      fieldKey: "group_defaults_label",
      labelKey: "orchestrationFormInventoryGroupDefaultsLabel",
      placeholderKey: "txBlockFormLabelPlaceholder",
    },
  ]);

export const ORCHESTRATION_INVENTORY_GROUP_METADATA_FIELD_DEFS = Object.freeze([
  {
    fieldKey: "group_label",
    labelKey: "orchestrationFormInventoryGroupLabel",
    placeholderKey: "txBlockFormLabelPlaceholder",
  },
]);

export const ORCHESTRATION_TARGET_METADATA_FIELD_DEFS = Object.freeze([
  {
    fieldKey: "target_label",
    labelKey: "orchestrationFormTargetLabel",
    placeholderKey: "txBlockFormLabelPlaceholder",
  },
]);

export const ORCHESTRATION_TX_BLOCK_DIRECT_METADATA_FIELD_DEFS = Object.freeze([
  {
    fieldKey: "tx_block_direct_label",
    labelKey: "orchestrationFormTxBlockDirectLabel",
    placeholderKey: "txBlockFormLabelPlaceholder",
  },
]);

export const ORCHESTRATION_TX_BLOCK_TEMPLATE_METADATA_FIELD_DEFS =
  Object.freeze([
    {
      fieldKey: "tx_block_template_label",
      labelKey: "orchestrationFormTxBlockTemplateLabel",
      placeholderKey: "txBlockFormLabelPlaceholder",
    },
  ]);

export const ORCHESTRATION_TX_BLOCK_FLOW_METADATA_FIELD_DEFS = Object.freeze([
  {
    fieldKey: "flow_template_label",
    labelKey: "orchestrationFormFlowTemplateLabel",
    placeholderKey: "txBlockFormLabelPlaceholder",
  },
]);

export const ORCHESTRATION_TX_WORKFLOW_METADATA_FIELD_DEFS = Object.freeze([
  {
    fieldKey: "workflow_action_label",
    labelKey: "orchestrationFormTxWorkflowLabel",
    placeholderKey: "txBlockFormLabelPlaceholder",
  },
]);

export const ORCHESTRATION_TX_BLOCK_EXECUTION_FIELD_DEFS = Object.freeze([
  {
    controlType: "input",
    fieldKey: "mode",
    inputType: "text",
    labelKey: "txBlockFormMode",
  },
  {
    controlType: "input",
    fieldKey: "timeoutSecs",
    inputType: "number",
    labelKey: "txBlockFormTimeout",
  },
  {
    controlType: "input",
    fieldKey: "resourceRollbackCommand",
    inputType: "text",
    labelKey: "orchestrationFormResourceRollbackCommand",
  },
  {
    controlType: "select",
    fieldKey: "rollbackOnFailure",
    labelKey: "txBlockFormRollbackOnFailure",
    optionKind: "boolean",
  },
  {
    controlType: "input",
    fieldKey: "rollbackTriggerStepIndex",
    inputType: "number",
    labelKey: "txBlockFormTriggerStepIndex",
  },
]);

function orchestrationPresenceFieldKey(fieldKey = "") {
  const key = orchestrationStringValue(fieldKey);
  if (!key) return "";
  return `has${key[0].toUpperCase()}${key.slice(1)}`;
}

export function orchestrationFieldEnabled(model = {}, fieldKey = "") {
  const presenceKey = orchestrationPresenceFieldKey(fieldKey);
  if (!presenceKey) return true;
  return !!model[presenceKey] || model[fieldKey] !== null;
}

export function orchestrationObjectEnabled(model = {}, fieldKey = "") {
  const presenceKey = orchestrationPresenceFieldKey(fieldKey);
  const value = model?.[fieldKey];
  if (!!model?.[presenceKey]) return true;
  if (Array.isArray(value)) return value.length > 0;
  if (orchestrationPlainObject(value)) return Object.keys(value).length > 0;
  return value != null;
}

export function orchestrationFieldSupportsNullableMode(fieldRow = {}) {
  return ORCHESTRATION_CONNECTION_NULLABLE_FIELD_KEYS.has(
    orchestrationStringValue(fieldRow.fieldKey),
  );
}

export function orchestrationTextListRows(listEntries = []) {
  return (Array.isArray(listEntries) ? listEntries : []).map(
    (text, itemIndex) => ({
      text,
      itemIndex,
    }),
  );
}

export function orchestrationTextListValue(listEntries = []) {
  return (Array.isArray(listEntries) ? listEntries : [])
    .map((listEntry) => orchestrationStringValue(listEntry).trim())
    .filter(Boolean)
    .join(", ");
}

export function orchestrationJsonFieldText(jsonValue = {}, fallback = {}) {
  return JSON.stringify(
    orchestrationCloneJsonValue(jsonValue, fallback),
    null,
    2,
  );
}

export function orchestrationNullableModeRows() {
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

function orchestrationStrategyOptionRows(strategyRows = [], selected = "") {
  return selectOptionsWithCurrent(strategyRows, selected).map(
    (optionValue) => ({
      optionLabel: optionValue,
      optionValue,
    }),
  );
}

function orchestrationStageLikeFieldsDisplay(
  fieldDefs = [],
  sourceValue = {},
  strategyRows = [],
  booleanRows = [],
) {
  const value = orchestrationPlainObject(sourceValue) ? sourceValue : {};
  const showsJobNamePresenceToggle = fieldDefs.some(
    (stageLikeField) =>
      stageLikeField.fieldKey === "name" &&
      stageLikeField.labelKey === "orchestrationFormJob",
  );
  return fieldDefs.map((fieldDef) => {
    const presenceKey = `has${fieldDef.fieldKey[0].toUpperCase()}${fieldDef.fieldKey.slice(1)}`;
    if (fieldDef.optionKind === "strategy") {
      return {
        ...fieldDef,
        enabled: true,
        labelText: t(fieldDef.labelKey),
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
      return {
        ...fieldDef,
        enabled: !!value[presenceKey] || value.failFast !== null,
        labelText: t(fieldDef.labelKey),
        optionRows: selectOptionsWithCurrent(
          booleanRows,
          value.failFast ? "true" : "false",
        ).map((optionValue) => ({
          optionLabel: optionValue,
          optionValue,
        })),
        placeholderText: "",
        showPresenceToggle: true,
        valueText: value.failFast ? "true" : "false",
      };
    }
    const valueText =
      fieldDef.inputType === "number"
        ? (orchestrationNullableNumberValue(value[fieldDef.fieldKey]) ?? "")
        : orchestrationStringValue(value[fieldDef.fieldKey] ?? "");
    return {
      ...fieldDef,
      enabled:
        fieldDef.fieldKey === "name"
          ? !showsJobNamePresenceToggle ||
            !!value[presenceKey] ||
            value.name !== null
          : !!value[presenceKey] || value[fieldDef.fieldKey] !== null,
      labelText: t(fieldDef.labelKey),
      nullableModeRows:
        fieldDef.fieldKey === "name" && showsJobNamePresenceToggle
          ? orchestrationNullableModeRows()
          : [],
      nullableModeValue:
        fieldDef.fieldKey === "name" && value.name === null ? "null" : "value",
      placeholderText: "",
      showNullableModeSelect:
        fieldDef.fieldKey === "name" &&
        showsJobNamePresenceToggle &&
        (!!value[presenceKey] || value.name !== null),
      showPresenceToggle:
        fieldDef.fieldKey === "name" ? showsJobNamePresenceToggle : true,
      valueText,
    };
  });
}

function orchestrationStageLikeFieldPatch(fieldKey = "", fieldValue = "") {
  if (fieldKey === "name") {
    return { name: fieldValue, hasName: true };
  }
  if (fieldKey === "strategy") {
    return { strategy: fieldValue };
  }
  if (fieldKey === "maxParallel") {
    return { maxParallel: fieldValue, hasMaxParallel: true };
  }
  return { failFast: fieldValue === "true", hasFailFast: true };
}

export function orchestrationRootFieldsDisplay(model = {}, booleanRows = []) {
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
        enabled,
        labelText: t(fieldDef.labelKey),
        optionRows: selectOptionsWithCurrent(
          booleanRows,
          booleanValue ? "true" : "false",
        ).map((optionValue) => ({
          optionLabel: optionValue,
          optionValue,
        })),
        placeholderText: "",
        showPresenceToggle: true,
        valueText: booleanValue ? "true" : "false",
      };
    }
    return {
      ...fieldDef,
      enabled:
        fieldDef.fieldKey === "name"
          ? true
          : !!rootValue[presenceKey] || rootValue[fieldDef.fieldKey] !== null,
      labelText: t(fieldDef.labelKey),
      nullableModeRows:
        fieldDef.fieldKey === "inventoryFile"
          ? orchestrationNullableModeRows()
          : [],
      nullableModeValue:
        fieldDef.fieldKey === "inventoryFile" &&
        rootValue.inventoryFile === null
          ? "null"
          : "value",
      placeholderText: "",
      showNullableModeSelect:
        fieldDef.fieldKey === "inventoryFile" &&
        (!!rootValue[presenceKey] || rootValue[fieldDef.fieldKey] !== null),
      showPresenceToggle: fieldDef.fieldKey !== "name",
      valueText: orchestrationStringValue(rootValue[fieldDef.fieldKey] ?? ""),
    };
  });
}

export function orchestrationStageFieldsDisplay(
  stage = {},
  strategyRows = [],
  booleanRows = [],
) {
  return orchestrationStageLikeFieldsDisplay(
    ORCHESTRATION_STAGE_FIELD_DEFS,
    stage,
    strategyRows,
    booleanRows,
  );
}

export function orchestrationJobFieldsDisplay(
  job = {},
  strategyRows = [],
  booleanRows = [],
) {
  return orchestrationStageLikeFieldsDisplay(
    ORCHESTRATION_JOB_FIELD_DEFS,
    job,
    strategyRows,
    booleanRows,
  );
}

export function orchestrationStageFieldPatch(fieldKey = "", fieldValue = "") {
  return orchestrationStageLikeFieldPatch(fieldKey, fieldValue);
}

export function orchestrationJobFieldPatch(fieldKey = "", fieldValue = "") {
  return orchestrationStageLikeFieldPatch(fieldKey, fieldValue);
}

function orchestrationSnakeCaseFieldKey(fieldKey = "") {
  return orchestrationStringValue(fieldKey).replace(
    /[A-Z]/g,
    (letter) => `_${letter.toLowerCase()}`,
  );
}

function orchestrationStructureFieldEntries(
  scope = "",
  formPrefix = "",
  fieldDefs = [],
  { editorKindByKey = {}, jsonPathByKey = {}, requiredKeys = new Set() } = {},
) {
  return fieldDefs.map((fieldDef) =>
    txStructureMappingEntry({
      scope,
      jsonPath:
        jsonPathByKey[fieldDef.fieldKey] ||
        orchestrationSnakeCaseFieldKey(fieldDef.fieldKey),
      formPath: formPrefix
        ? `${formPrefix}.${fieldDef.fieldKey}`
        : fieldDef.fieldKey,
      editorKind:
        editorKindByKey[fieldDef.fieldKey] ||
        (requiredKeys.has(fieldDef.fieldKey) ? "field" : "presence-field"),
      labelKey: fieldDef.labelKey,
    }),
  );
}

function orchestrationStructureMetadataEntries(
  scope = "",
  formPrefix = "extra",
  fieldDefs = [],
) {
  return fieldDefs.map((fieldDef) =>
    txStructureMappingEntry({
      scope,
      jsonPath: fieldDef.fieldKey,
      formPath: `${formPrefix}.${fieldDef.fieldKey}`,
      editorKind: "metadata-field",
      labelKey: fieldDef.labelKey,
    }),
  );
}

function buildOrchestrationJsonStructureMapping() {
  return Object.freeze([
    ...orchestrationStructureFieldEntries(
      "root",
      "",
      ORCHESTRATION_ROOT_FIELD_DEFS,
      {
        editorKindByKey: {
          inventoryFile: "presence-field",
          rollbackCompletedStagesOnFailure: "presence-field",
          rollbackOnStageFailure: "presence-field",
        },
        requiredKeys: new Set(["name"]),
      },
    ),
    txStructureMappingEntry({
      scope: "root",
      jsonPath: "inventory",
      formPath: "inventory",
      editorKind: "inventory-editor",
    }),
    txStructureMappingEntry({
      scope: "root",
      jsonPath: "stages",
      formPath: "stages",
      editorKind: "stage-list",
      labelKey: "orchestrationFormStage",
    }),
    ...orchestrationStructureMetadataEntries(
      "root",
      "extra",
      ORCHESTRATION_PLAN_METADATA_FIELD_DEFS,
    ),
    txStructureMappingEntry({
      scope: "root",
      jsonPath: "extra.*",
      formPath: "extra.*",
      editorKind: "json-object-extra",
    }),
    txStructureMappingEntry({
      scope: "inventory",
      jsonPath: "defaults",
      formPath: "defaults",
      editorKind: "inventory-defaults",
    }),
    txStructureMappingEntry({
      scope: "inventory",
      jsonPath: "groups",
      formPath: "groups",
      editorKind: "inventory-group-list",
    }),
    ...orchestrationStructureMetadataEntries(
      "inventory",
      "extra",
      ORCHESTRATION_INVENTORY_DEFAULTS_METADATA_FIELD_DEFS,
    ),
    txStructureMappingEntry({
      scope: "inventory",
      jsonPath: "extra.*",
      formPath: "extra.*",
      editorKind: "json-object-extra",
    }),
    ...orchestrationStructureFieldEntries(
      "inventory.defaults",
      "",
      ORCHESTRATION_DEFAULTS_FIELD_DEFS,
      {
        editorKindByKey: {
          deviceProfile: "presence-field",
          enablePassword: "presence-field",
          linuxShellFlavor: "presence-field",
          port: "presence-field",
          sshSecurity: "presence-field",
          templateDir: "presence-field",
          username: "presence-field",
          password: "presence-field",
        },
      },
    ),
    ...orchestrationStructureMetadataEntries(
      "inventory.defaults",
      "extra",
      ORCHESTRATION_INVENTORY_DEFAULTS_METADATA_FIELD_DEFS,
    ),
    txStructureMappingEntry({
      scope: "inventory.defaults",
      jsonPath: "vars",
      formPath: "vars",
      editorKind: "typed-object",
      labelKey: "orchestrationFormVars",
    }),
    txStructureMappingEntry({
      scope: "inventory.defaults",
      jsonPath: "extra.*",
      formPath: "extra.*",
      editorKind: "json-object-extra",
    }),
    ...orchestrationStructureFieldEntries("inventory.group", "", [
      {
        controlType: "input",
        fieldKey: "name",
        inputType: "text",
        labelKey: "orchestrationFormGroupName",
      },
    ]),
    txStructureMappingEntry({
      scope: "inventory.group",
      jsonPath: "defaults",
      formPath: "defaults",
      editorKind: "inventory-group-defaults",
    }),
    txStructureMappingEntry({
      scope: "inventory.group",
      jsonPath: "targets",
      formPath: "targets",
      editorKind: "target-list",
    }),
    ...orchestrationStructureMetadataEntries(
      "inventory.group",
      "extra",
      ORCHESTRATION_INVENTORY_GROUP_METADATA_FIELD_DEFS,
    ),
    txStructureMappingEntry({
      scope: "inventory.group",
      jsonPath: "extra.*",
      formPath: "extra.*",
      editorKind: "json-object-extra",
    }),
    ...orchestrationStructureFieldEntries(
      "inventory.group.defaults",
      "",
      ORCHESTRATION_DEFAULTS_FIELD_DEFS,
    ),
    ...orchestrationStructureMetadataEntries(
      "inventory.group.defaults",
      "extra",
      ORCHESTRATION_INVENTORY_GROUP_DEFAULTS_METADATA_FIELD_DEFS,
    ),
    txStructureMappingEntry({
      scope: "inventory.group.defaults",
      jsonPath: "vars",
      formPath: "vars",
      editorKind: "typed-object",
      labelKey: "orchestrationFormVars",
    }),
    txStructureMappingEntry({
      scope: "inventory.group.defaults",
      jsonPath: "extra.*",
      formPath: "extra.*",
      editorKind: "json-object-extra",
    }),
    ...orchestrationStructureFieldEntries(
      "inventory.group.target",
      "",
      ORCHESTRATION_TARGET_DETAIL_FIELD_DEFS,
    ),
    ...orchestrationStructureMetadataEntries(
      "inventory.group.target",
      "extra",
      ORCHESTRATION_TARGET_METADATA_FIELD_DEFS,
    ),
    txStructureMappingEntry({
      scope: "inventory.group.target",
      jsonPath: "vars",
      formPath: "vars",
      editorKind: "typed-object",
      labelKey: "orchestrationFormVars",
    }),
    txStructureMappingEntry({
      scope: "inventory.group.target",
      jsonPath: "extra.*",
      formPath: "extra.*",
      editorKind: "json-object-extra",
    }),
    ...orchestrationStructureFieldEntries(
      "stage",
      "",
      ORCHESTRATION_STAGE_FIELD_DEFS,
      {
        requiredKeys: new Set(["name", "strategy"]),
      },
    ),
    txStructureMappingEntry({
      scope: "stage",
      jsonPath: "jobs",
      formPath: "jobs",
      editorKind: "job-list",
      labelKey: "orchestrationFormJob",
    }),
    ...orchestrationStructureMetadataEntries(
      "stage",
      "extra",
      ORCHESTRATION_STAGE_METADATA_FIELD_DEFS,
    ),
    txStructureMappingEntry({
      scope: "stage",
      jsonPath: "extra.*",
      formPath: "extra.*",
      editorKind: "json-object-extra",
    }),
    ...orchestrationStructureFieldEntries(
      "job",
      "",
      ORCHESTRATION_JOB_FIELD_DEFS,
      {
        requiredKeys: new Set(["strategy"]),
      },
    ),
    ...orchestrationStructureMetadataEntries(
      "job",
      "extra",
      ORCHESTRATION_JOB_METADATA_FIELD_DEFS,
    ),
    txStructureMappingEntry({
      scope: "job",
      jsonPath: "target_groups",
      formPath: "targetGroups",
      editorKind: "string-list",
      labelKey: "inventoryFieldGroups",
    }),
    txStructureMappingEntry({
      scope: "job",
      jsonPath: "target_tags",
      formPath: "targetTags",
      editorKind: "string-list",
      labelKey: "inventoryFieldLabels",
    }),
    txStructureMappingEntry({
      scope: "job",
      jsonPath: "targets",
      formPath: "targets",
      editorKind: "target-list",
      labelKey: "fieldConnection",
    }),
    txStructureMappingEntry({
      scope: "job",
      jsonPath: "action",
      formPath: "action",
      editorKind: "action-editor",
      labelKey: "orchestrationFormActionKind",
    }),
    txStructureMappingEntry({
      scope: "job",
      jsonPath: "extra.*",
      formPath: "extra.*",
      editorKind: "json-object-extra",
    }),
    ...orchestrationStructureFieldEntries(
      "job.target",
      "",
      ORCHESTRATION_TARGET_DETAIL_FIELD_DEFS,
    ),
    ...orchestrationStructureMetadataEntries(
      "job.target",
      "extra",
      ORCHESTRATION_TARGET_METADATA_FIELD_DEFS,
    ),
    txStructureMappingEntry({
      scope: "job.target",
      jsonPath: "vars",
      formPath: "vars",
      editorKind: "typed-object",
      labelKey: "orchestrationFormVars",
    }),
    txStructureMappingEntry({
      scope: "job.target",
      jsonPath: "extra.*",
      formPath: "extra.*",
      editorKind: "json-object-extra",
    }),
    txStructureMappingEntry({
      scope: "job.action",
      jsonPath: "kind",
      formPath: "kind",
      editorKind: "select-field",
      labelKey: "orchestrationFormActionKind",
    }),
    ...orchestrationStructureFieldEntries(
      "job.action.tx_block",
      "",
      ORCHESTRATION_TX_BLOCK_EXECUTION_FIELD_DEFS,
    ),
    txStructureMappingEntry({
      scope: "job.action.tx_block",
      jsonPath: "vars",
      formPath: "vars",
      editorKind: "typed-object",
      labelKey: "orchestrationFormVars",
    }),
    txStructureMappingEntry({
      scope: "job.action.tx_block",
      jsonPath: "commands",
      formPath: "commands",
      editorKind: "string-list",
      labelKey: "fieldCommand",
    }),
    txStructureMappingEntry({
      scope: "job.action.tx_block",
      jsonPath: "rollback_commands",
      formPath: "rollbackCommands",
      editorKind: "string-list",
      labelKey: "txBlockFormRollbackLabel",
    }),
    txStructureMappingEntry({
      scope: "job.action.tx_block",
      jsonPath: "tx_block_template_name",
      formPath: "txBlockTemplateName",
      editorKind: "presence-field",
      labelKey: "orchestrationFormTxBlockTemplateName",
    }),
    txStructureMappingEntry({
      scope: "job.action.tx_block",
      jsonPath: "tx_block_template_content",
      formPath: "txBlockTemplateContent",
      editorKind: "presence-field",
      labelKey: "orchestrationFormTxBlockTemplateContent",
    }),
    txStructureMappingEntry({
      scope: "job.action.tx_block",
      jsonPath: "tx_block_template_vars",
      formPath: "txBlockTemplateVars",
      editorKind: "typed-object",
      labelKey: "orchestrationFormTxBlockTemplateVars",
    }),
    txStructureMappingEntry({
      scope: "job.action.tx_block",
      jsonPath: "flow_template_name",
      formPath: "flowTemplateName",
      editorKind: "presence-field",
      labelKey: "orchestrationFormFlowTemplateName",
    }),
    txStructureMappingEntry({
      scope: "job.action.tx_block",
      jsonPath: "flow_template_content",
      formPath: "flowTemplateContent",
      editorKind: "presence-field",
      labelKey: "orchestrationFormFlowTemplateContent",
    }),
    txStructureMappingEntry({
      scope: "job.action.tx_block",
      jsonPath: "flow_vars",
      formPath: "flowVars",
      editorKind: "typed-object",
      labelKey: "orchestrationFormFlowVars",
    }),
    ...orchestrationStructureMetadataEntries(
      "job.action.tx_block",
      "extra",
      ORCHESTRATION_TX_BLOCK_DIRECT_METADATA_FIELD_DEFS,
    ),
    ...orchestrationStructureMetadataEntries(
      "job.action.tx_block",
      "extra",
      ORCHESTRATION_TX_BLOCK_TEMPLATE_METADATA_FIELD_DEFS,
    ),
    ...orchestrationStructureMetadataEntries(
      "job.action.tx_block",
      "extra",
      ORCHESTRATION_TX_BLOCK_FLOW_METADATA_FIELD_DEFS,
    ),
    txStructureMappingEntry({
      scope: "job.action.tx_block",
      jsonPath: "extra.*",
      formPath: "extra.*",
      editorKind: "json-object-extra",
    }),
    txStructureMappingEntry({
      scope: "job.action.tx_workflow",
      jsonPath: "workflow_file",
      formPath: "workflowFile",
      editorKind: "presence-field",
      labelKey: "orchestrationFormWorkflowFile",
    }),
    txStructureMappingEntry({
      scope: "job.action.tx_workflow",
      jsonPath: "workflow",
      formPath: "workflow",
      editorKind: "typed-object",
      labelKey: "orchestrationFormWorkflowJson",
    }),
    txStructureMappingEntry({
      scope: "job.action.tx_workflow",
      jsonPath: "workflow_template_name",
      formPath: "workflowTemplateName",
      editorKind: "presence-field",
      labelKey: "orchestrationFormWorkflowTemplateName",
    }),
    txStructureMappingEntry({
      scope: "job.action.tx_workflow",
      jsonPath: "workflow_template_content",
      formPath: "workflowTemplateContent",
      editorKind: "presence-field",
      labelKey: "orchestrationFormWorkflowTemplateContent",
    }),
    txStructureMappingEntry({
      scope: "job.action.tx_workflow",
      jsonPath: "workflow_vars",
      formPath: "workflowVars",
      editorKind: "typed-object",
      labelKey: "orchestrationFormWorkflowVars",
    }),
    ...orchestrationStructureMetadataEntries(
      "job.action.tx_workflow",
      "extra",
      ORCHESTRATION_TX_WORKFLOW_METADATA_FIELD_DEFS,
    ),
    txStructureMappingEntry({
      scope: "job.action.tx_workflow",
      jsonPath: "extra.*",
      formPath: "extra.*",
      editorKind: "json-object-extra",
    }),
  ]);
}

export function orchestrationJsonStructureMapping() {
  if (!ORCHESTRATION_JSON_STRUCTURE_MAPPING) {
    ORCHESTRATION_JSON_STRUCTURE_MAPPING =
      buildOrchestrationJsonStructureMapping();
  }
  return ORCHESTRATION_JSON_STRUCTURE_MAPPING;
}

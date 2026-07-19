import { t } from "../../lib/i18n.js";
import { selectOptionsWithCurrent } from "../../lib/ui.js";
import {
  cloneJsonValue,
  nullableNumberValue,
  plainObject,
  stringValue,
} from "../../lib/jsonValue.js";
import { txStructureMappingEntry } from "../transactions/transactionStructure.js";

const orchestrationPlainObject = plainObject;
const orchestrationStringValue = stringValue;
const orchestrationNullableNumberValue = nullableNumberValue;
const orchestrationCloneJsonValue = cloneJsonValue;

let ORCHESTRATION_JSON_STRUCTURE_MAPPING = null;

export const ORCHESTRATION_ROOT_FIELD_DEFS = Object.freeze([
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

export const ORCHESTRATION_STAGE_FIELD_DEFS = Object.freeze([
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

export const ORCHESTRATION_JOB_FIELD_DEFS = Object.freeze([
  {
    controlType: "input",
    fieldKey: "name",
    inputType: "text",
    labelKey: "orchestrationFormJob",
  },
  ...ORCHESTRATION_STAGE_FIELD_DEFS.slice(1),
]);

export const ORCHESTRATION_PLAN_METADATA_FIELD_DEFS = Object.freeze([]);
export const ORCHESTRATION_STAGE_METADATA_FIELD_DEFS = Object.freeze([]);
export const ORCHESTRATION_JOB_METADATA_FIELD_DEFS = Object.freeze([]);

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
  fieldDefs = [],
  sourceValue = {},
  strategyRows = [],
  booleanRows = [],
  labelKeys = {},
) {
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
          ...selectOptionsWithCurrent(booleanRows, optionalBooleanValue)
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

function orchestrationStageLikeFieldPatch(fieldKey = "", fieldValue = "") {
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
        enabled: true,
        labelText: t(fieldDef.labelKey),
        optionRows: selectOptionsWithCurrent(
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
    {
      name: "orchestrationStageNameLabel",
      strategy: "orchestrationStageStrategyLabel",
      maxParallel: "orchestrationStageMaxParallelLabel",
      failFast: "orchestrationStageFailFastLabel",
    },
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
    {
      name: "orchestrationJobNameLabel",
      strategy: "orchestrationJobStrategyLabel",
      maxParallel: "orchestrationJobMaxParallelLabel",
      failFast: "orchestrationJobFailFastLabel",
    },
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
          rollbackCompletedStagesOnFailure: "presence-field",
          rollbackOnStageFailure: "presence-field",
        },
        requiredKeys: new Set(["name"]),
      },
    ),
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
      editorKind: "saved-connection-list",
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
    txStructureMappingEntry({
      scope: "job.action",
      jsonPath: "kind",
      formPath: "kind",
      editorKind: "fixed-field",
      labelKey: "orchestrationFormActionKind",
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
      jsonPath: "workflow_vars",
      formPath: "workflowVars",
      editorKind: "typed-object",
      labelKey: "orchestrationFormWorkflowVars",
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

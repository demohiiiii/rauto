import {
  callbackMappedFormCheckedHandler,
  callbackMappedFormValueHandler,
} from "../../lib/events.js";
import { plainObject, stringValue } from "../../lib/jsonValue.js";
import { t } from "../../lib/i18n.js";
import { selectOptionsWithCurrent } from "../../lib/ui.js";
import {
  defaultTxBlockTemplatePayload,
  defaultTxWorkflowTemplateRefBlockPayload,
  txBlockFormModelFromJson,
  txWorkflowBlockFormModelFromJson,
  txWorkflowTemplateRefBlockModelFromJson,
} from "./transactionBlockFormModels.js";
import {
  TX_BLOCK_BOOLEAN_ROWS,
  TX_BLOCK_JSON_VALUE_TYPE_ROWS,
} from "./transactionBlockDisplayState.js";

const txPlainObject = plainObject;
const txStringValue = stringValue;

const TX_WORKFLOW_BLOCK_SOURCE_ROWS = Object.freeze(["inline", "template_ref"]);
const TX_WORKFLOW_ROOT_FIELD_DEFS = Object.freeze([
  {
    controlType: "input",
    fieldKey: "name",
    inputType: "text",
    labelKey: "txWorkflowFormName",
  },
  {
    controlType: "select",
    fieldKey: "failFast",
    labelKey: "txBlockFormFailFast",
    optionKind: "boolean",
  },
]);
const TX_WORKFLOW_BLOCK_FIELD_DEFS = Object.freeze([
  {
    controlType: "select",
    fieldKey: "sourceKind",
    labelKey: "txWorkflowFormBlockSource",
  },
]);
const TX_WORKFLOW_TEMPLATE_REF_FIELD_DEFS = Object.freeze([
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
const TX_WORKFLOW_TEMPLATE_REF_SOURCE_MODE_ROWS = Object.freeze([
  "name",
  "content",
]);
const TX_WORKFLOW_NULLABLE_MODE_ROWS = Object.freeze([
  { value: "value", labelKey: "txBlockNullableModeValue" },
  { value: "null", labelKey: "txBlockNullableModeNull" },
]);

function workflowBoolStringValue(value) {
  return value === "true" || value === true;
}

function workflowNullableTextValue(value) {
  return value == null ? null : String(value);
}

function workflowNullableModeValue(value = "") {
  return value === "null" ? "null" : "value";
}

function workflowNullableModeRows() {
  return TX_WORKFLOW_NULLABLE_MODE_ROWS.map((optionRow) => ({
    optionLabel: t(optionRow.labelKey),
    optionValue: optionRow.value,
  }));
}

function workflowWithNullableMode(
  fieldDef = {},
  sourceValue = {},
  fieldRow = {},
) {
  if (fieldDef.optionKind === "boolean") return fieldRow;
  return {
    ...fieldRow,
    nullableModeRows: workflowNullableModeRows(),
    nullableModeValue:
      sourceValue?.[fieldDef.fieldKey] === null ? "null" : "value",
    showNullableModeSelect: !!fieldRow.enabled,
  };
}

function workflowNullableFieldModePatch(
  model = {},
  field,
  mode,
  fallback = "",
) {
  const value = txPlainObject(model) ? model : {};
  const hasKey = `has${field[0].toUpperCase()}${field.slice(1)}`;
  if (workflowNullableModeValue(mode) === "null") {
    return {
      [field]: null,
      [hasKey]: true,
    };
  }
  return {
    [field]:
      value?.[field] == null ? String(fallback ?? "") : String(value[field]),
    [hasKey]: true,
  };
}

function workflowToggleNullableFieldPresence(model = {}, field, enabled) {
  const value = txPlainObject(model) ? model : {};
  const hasKey = `has${field[0].toUpperCase()}${field.slice(1)}`;
  return {
    ...value,
    [field]: enabled ? (value[field] ?? "") : null,
    [hasKey]: enabled,
  };
}

function workflowToggleObjectFieldPresence(model = {}, field, enabled) {
  const value = txPlainObject(model) ? model : {};
  const hasKey = `has${field[0].toUpperCase()}${field.slice(1)}`;
  return {
    ...value,
    [field]:
      enabled && txPlainObject(value[field])
        ? { ...value[field] }
        : enabled
          ? {}
          : {},
    [hasKey]: enabled,
  };
}

function workflowCloneModel(model) {
  return structuredClone(model || {});
}

function txWorkflowUpdateBlock(model, blockIndex, updater) {
  const next = workflowCloneModel(model);
  if (!Array.isArray(next.blocks)) next.blocks = [];
  next.blocks[blockIndex] = updater(
    next.blocks[blockIndex] || txWorkflowBlockFormModelFromJson(),
  );
  return next;
}

function workflowApplyChange(onChange, nextModel) {
  return typeof onChange === "function" ? onChange(nextModel) : undefined;
}

function txWorkflowChangeRoot(model, key, value) {
  const next = workflowCloneModel(model);
  next[key] = key === "failFast" ? workflowBoolStringValue(value) : value;
  if (key === "failFast") next.hasFailFast = true;
  return next;
}

export function txWorkflowAddBlock(model) {
  const next = workflowCloneModel(model);
  if (!Array.isArray(next.blocks)) next.blocks = [];
  next.blocks.push(
    txWorkflowBlockFormModelFromJson(defaultTxBlockTemplatePayload()),
  );
  return next;
}

export function txWorkflowRemoveBlock(model, blockIndex) {
  const next = workflowCloneModel(model);
  if (!Array.isArray(next.blocks)) next.blocks = [];
  next.blocks.splice(blockIndex, 1);
  return next;
}

export function txWorkflowDuplicateBlock(model, blockIndex) {
  const next = workflowCloneModel(model);
  if (!Array.isArray(next.blocks) || !next.blocks[blockIndex]) return next;
  next.blocks.splice(
    blockIndex + 1,
    0,
    workflowCloneModel(next.blocks[blockIndex]),
  );
  return next;
}

export function txWorkflowMoveBlock(model, blockIndex, targetIndex) {
  const next = workflowCloneModel(model);
  if (
    !Array.isArray(next.blocks) ||
    blockIndex < 0 ||
    targetIndex < 0 ||
    blockIndex >= next.blocks.length ||
    targetIndex >= next.blocks.length ||
    blockIndex === targetIndex
  ) {
    return next;
  }
  const [block] = next.blocks.splice(blockIndex, 1);
  next.blocks.splice(targetIndex, 0, block);
  return next;
}

function txWorkflowChangeBlockSource(model, blockIndex, sourceKind) {
  return txWorkflowUpdateBlock(model, blockIndex, (currentBlock) => ({
    sourceKind: sourceKind === "template_ref" ? "template_ref" : "inline",
    inlineBlock:
      currentBlock.inlineBlock ||
      txBlockFormModelFromJson(defaultTxBlockTemplatePayload()),
    templateRef:
      currentBlock.templateRef ||
      txWorkflowTemplateRefBlockModelFromJson(
        defaultTxWorkflowTemplateRefBlockPayload(),
      ),
  }));
}

function txWorkflowUpdateInlineBlock(model, blockIndex, inlineBlock) {
  return txWorkflowUpdateBlock(model, blockIndex, (currentBlock) => ({
    ...currentBlock,
    inlineBlock,
  }));
}

function txWorkflowPatchTemplateRefBlock(model, blockIndex, patch = {}) {
  return txWorkflowUpdateBlock(model, blockIndex, (currentBlock) => ({
    ...currentBlock,
    templateRef: {
      ...(currentBlock.templateRef ||
        txWorkflowTemplateRefBlockModelFromJson(
          defaultTxWorkflowTemplateRefBlockPayload(),
        )),
      ...patch,
    },
  }));
}

export function txWorkflowSetRootFieldPresence(model = {}, field, enabled) {
  const next = workflowCloneModel(model);
  if (field === "failFast") {
    next.failFast = enabled ? !!next.failFast : true;
    next.hasFailFast = enabled;
  }
  return next;
}

export function txWorkflowSetTemplateRefFieldPresence(
  model,
  blockIndex,
  field,
  enabled,
) {
  const currentBlock = model?.blocks?.[blockIndex] || {};
  const templateRef = currentBlock.templateRef || {};
  let patch;
  if (field === "failFast") {
    patch = {
      ...templateRef,
      failFast: enabled ? !!templateRef?.failFast : true,
      hasFailFast: enabled,
    };
  } else {
    patch = workflowToggleNullableFieldPresence(templateRef, field, enabled);
  }
  return txWorkflowPatchTemplateRefBlock(model, blockIndex, patch);
}

export function txWorkflowSetTemplateRefVarsPresence(
  model,
  blockIndex,
  enabled,
) {
  const currentBlock = model?.blocks?.[blockIndex] || {};
  const templateRef = currentBlock.templateRef || {};
  return txWorkflowPatchTemplateRefBlock(
    model,
    blockIndex,
    workflowToggleObjectFieldPresence(
      templateRef,
      "txBlockTemplateVars",
      enabled,
    ),
  );
}

export function txWorkflowRootFieldsDisplay(model = {}, booleanRows = []) {
  const workflowValue = txPlainObject(model) ? model : {};
  return TX_WORKFLOW_ROOT_FIELD_DEFS.map((fieldDef) => {
    if (fieldDef.optionKind === "boolean") {
      return {
        ...fieldDef,
        enabled: !!workflowValue.hasFailFast || workflowValue.failFast !== true,
        labelText: t(fieldDef.labelKey),
        optionRows: selectOptionsWithCurrent(
          booleanRows,
          workflowValue.failFast ? "true" : "false",
        ).map((optionValue) => ({
          optionLabel: optionValue,
          optionValue,
        })),
        placeholderText: "",
        showPresenceToggle: true,
        valueText: workflowValue.failFast ? "true" : "false",
      };
    }
    return {
      ...fieldDef,
      enabled: true,
      labelText: t(fieldDef.labelKey),
      placeholderText: "",
      showPresenceToggle: false,
      valueText: txStringValue(workflowValue[fieldDef.fieldKey]),
    };
  });
}

export function txWorkflowBlockFieldsDisplay(block = {}) {
  const blockValue = txPlainObject(block) ? block : {};
  return TX_WORKFLOW_BLOCK_FIELD_DEFS.map((fieldDef) => ({
    ...fieldDef,
    enabled: true,
    labelText: t(fieldDef.labelKey),
    optionRows: TX_WORKFLOW_BLOCK_SOURCE_ROWS.map((optionValue) => ({
      optionLabel:
        optionValue === "template_ref"
          ? t("txWorkflowBlockSourceTemplate")
          : t("txWorkflowBlockSourceInline"),
      optionValue,
    })),
    placeholderText: "",
    showPresenceToggle: false,
    valueText: txStringValue(blockValue[fieldDef.fieldKey]),
  }));
}

export function txWorkflowTemplateRefFieldsDisplay(
  templateRef = {},
  booleanRows = [],
) {
  const templateRefValue = txPlainObject(templateRef) ? templateRef : {};
  return TX_WORKFLOW_TEMPLATE_REF_FIELD_DEFS.map((fieldDef) => {
    const presenceKey = `has${fieldDef.fieldKey[0].toUpperCase()}${fieldDef.fieldKey.slice(1)}`;
    if (fieldDef.optionKind === "boolean") {
      return {
        ...fieldDef,
        enabled:
          !!templateRefValue[presenceKey] || templateRefValue.failFast !== true,
        labelText: t(fieldDef.labelKey),
        optionRows: selectOptionsWithCurrent(
          booleanRows,
          templateRefValue.failFast ? "true" : "false",
        ).map((optionValue) => ({
          optionLabel: optionValue,
          optionValue,
        })),
        placeholderText: "",
        showPresenceToggle: true,
        valueText: templateRefValue.failFast ? "true" : "false",
      };
    }
    return workflowWithNullableMode(fieldDef, templateRefValue, {
      ...fieldDef,
      enabled:
        !!templateRefValue[presenceKey] ||
        templateRefValue[fieldDef.fieldKey] !== null,
      labelText: t(fieldDef.labelKey),
      placeholderText: fieldDef.placeholderKey
        ? t(fieldDef.placeholderKey)
        : "",
      showPresenceToggle: true,
      valueText: txStringValue(templateRefValue[fieldDef.fieldKey] ?? ""),
    });
  });
}

export function txWorkflowTemplateRefSourceDisplay(templateRef = {}) {
  const templateRefValue = txPlainObject(templateRef) ? templateRef : {};
  const sourceMode =
    templateRefValue.hasTxBlockTemplateContent ||
    templateRefValue.txBlockTemplateContent != null
      ? "content"
      : "name";
  const sourceModeField = {
    controlType: "select",
    enabled: true,
    fieldKey: "sourceMode",
    labelText: t("txWorkflowFormBlockTemplateSourceMode"),
    optionRows: TX_WORKFLOW_TEMPLATE_REF_SOURCE_MODE_ROWS.map(
      (optionValue) => ({
        optionLabel:
          optionValue === "content"
            ? t("txWorkflowTemplateSourceContent")
            : t("txWorkflowTemplateSourceName"),
        optionValue,
      }),
    ),
    placeholderText: "",
    showPresenceToggle: false,
    valueText: sourceMode,
  };
  const sourceField =
    sourceMode === "content"
      ? {
          controlType: "textarea",
          enabled:
            !!templateRefValue.hasTxBlockTemplateContent ||
            templateRefValue.txBlockTemplateContent !== null,
          fieldKey: "txBlockTemplateContent",
          labelText: t("txWorkflowFormBlockTemplateContent"),
          placeholderText: "",
          showPresenceToggle: true,
          showNullableModeSelect:
            !!templateRefValue.hasTxBlockTemplateContent ||
            templateRefValue.txBlockTemplateContent !== null,
          nullableModeRows: workflowNullableModeRows(),
          nullableModeValue:
            templateRefValue.txBlockTemplateContent === null ? "null" : "value",
          valueText: txStringValue(
            templateRefValue.txBlockTemplateContent ?? "",
          ),
        }
      : {
          controlType: "input",
          enabled:
            !!templateRefValue.hasTxBlockTemplateName ||
            templateRefValue.txBlockTemplateName !== null,
          fieldKey: "txBlockTemplateName",
          inputType: "text",
          labelText: t("txWorkflowFormBlockTemplateName"),
          placeholderText: "",
          showPresenceToggle: true,
          showNullableModeSelect:
            !!templateRefValue.hasTxBlockTemplateName ||
            templateRefValue.txBlockTemplateName !== null,
          nullableModeRows: workflowNullableModeRows(),
          nullableModeValue:
            templateRefValue.txBlockTemplateName === null ? "null" : "value",
          valueText: txStringValue(templateRefValue.txBlockTemplateName ?? ""),
        };
  return {
    hintText: t("txWorkflowFormBlockTemplateSourceHint"),
    sourceField,
    sourceMode,
    sourceModeField,
  };
}

export function txWorkflowTemplateRefVarsDisplay(templateRef = {}) {
  const templateRefValue = txPlainObject(templateRef) ? templateRef : {};
  return {
    labelText: t("txWorkflowFormBlockTemplateVars"),
    present:
      !!templateRefValue.hasTxBlockTemplateVars ||
      Object.keys(
        txPlainObject(templateRefValue.txBlockTemplateVars)
          ? templateRefValue.txBlockTemplateVars
          : {},
      ).length > 0,
    source: txPlainObject(templateRefValue.txBlockTemplateVars)
      ? templateRefValue.txBlockTemplateVars
      : {},
  };
}

export function txWorkflowTemplateRefEditorDisplay(
  templateRef = {},
  booleanRows = [],
) {
  const templateRefValue = txPlainObject(templateRef) ? templateRef : {};
  return {
    extraSource: txPlainObject(templateRefValue.extra)
      ? templateRefValue.extra
      : {},
    fieldRows: txWorkflowTemplateRefFieldsDisplay(
      templateRefValue,
      booleanRows,
    ),
    sourceDisplay: txWorkflowTemplateRefSourceDisplay(templateRefValue),
    varsDisplay: txWorkflowTemplateRefVarsDisplay(templateRefValue),
  };
}

export function txWorkflowTemplateRefEditorBindings(
  templateRef = {},
  blockBindings = {},
) {
  const applyPatch = (patch = {}) =>
    typeof blockBindings.patchTemplateRef === "function"
      ? blockBindings.patchTemplateRef(patch)
      : undefined;
  const setTemplateSource = (field, pairedField, value) => {
    const nextValue = workflowNullableTextValue(value);
    applyPatch({
      [field]: nextValue,
      [`has${field[0].toUpperCase()}${field.slice(1)}`]: true,
      ...(nextValue
        ? {
            [pairedField]: null,
            [`has${pairedField[0].toUpperCase()}${pairedField.slice(1)}`]: false,
          }
        : {}),
    });
  };
  return {
    setExtra(extra) {
      applyPatch({ extra });
    },
    setTemplateVars(txBlockTemplateVars) {
      applyPatch({
        txBlockTemplateVars,
        hasTxBlockTemplateVars: true,
      });
    },
    presenceToggle(field) {
      return callbackMappedFormCheckedHandler(
        (enabled) =>
          typeof blockBindings.setTemplateRefFieldPresence === "function"
            ? blockBindings.setTemplateRefFieldPresence(field, enabled)
            : undefined,
        (enabled) => enabled,
      );
    },
    nullableModeHandler(fieldKey) {
      return callbackMappedFormValueHandler(
        (value) =>
          applyPatch(
            workflowNullableFieldModePatch(templateRef, fieldKey, value),
          ),
        (value) => value,
      );
    },
    valueHandler(fieldKey) {
      if (fieldKey === "failFast") {
        return callbackMappedFormValueHandler(
          (value) =>
            applyPatch({
              failFast: value === "true",
              hasFailFast: true,
            }),
          (value) => value,
        );
      }
      return callbackMappedFormValueHandler(
        (value) =>
          applyPatch({
            name: workflowNullableTextValue(value),
            hasName: true,
          }),
        (value) => value,
      );
    },
    sourceModeHandler() {
      return callbackMappedFormValueHandler(
        (sourceMode) =>
          applyPatch(
            sourceMode === "content"
              ? {
                  txBlockTemplateName: null,
                  hasTxBlockTemplateName: false,
                }
              : {
                  txBlockTemplateContent: null,
                  hasTxBlockTemplateContent: false,
                },
          ),
        (value) => value,
      );
    },
    templateContentHandler() {
      return callbackMappedFormValueHandler(
        (value) =>
          setTemplateSource(
            "txBlockTemplateContent",
            "txBlockTemplateName",
            value,
          ),
        (value) => value,
      );
    },
    templateContentModeHandler() {
      return callbackMappedFormValueHandler(
        (mode) =>
          applyPatch(
            workflowNullableFieldModePatch(
              templateRef,
              "txBlockTemplateContent",
              mode,
            ),
          ),
        (value) => value,
      );
    },
    templateNameHandler() {
      return callbackMappedFormValueHandler(
        (value) =>
          setTemplateSource(
            "txBlockTemplateName",
            "txBlockTemplateContent",
            value,
          ),
        (value) => value,
      );
    },
    templateNameModeHandler() {
      return callbackMappedFormValueHandler(
        (mode) =>
          applyPatch(
            workflowNullableFieldModePatch(
              templateRef,
              "txBlockTemplateName",
              mode,
            ),
          ),
        (value) => value,
      );
    },
    varsToggle() {
      return callbackMappedFormCheckedHandler(
        (enabled) =>
          typeof blockBindings.setTemplateRefVarsPresence === "function"
            ? blockBindings.setTemplateRefVarsPresence(enabled)
            : undefined,
        (enabled) => enabled,
      );
    },
  };
}

function txWorkflowEditorBindings(model, onChange) {
  const applyChange = (nextModel) => workflowApplyChange(onChange, nextModel);
  return {
    addBlock() {
      applyChange(txWorkflowAddBlock(model));
    },
    duplicateBlock(blockIndex) {
      applyChange(txWorkflowDuplicateBlock(model, blockIndex));
    },
    moveBlock(blockIndex, targetIndex) {
      applyChange(txWorkflowMoveBlock(model, blockIndex, targetIndex));
    },
    patchTemplateRefBlock(blockIndex, patch = {}) {
      applyChange(txWorkflowPatchTemplateRefBlock(model, blockIndex, patch));
    },
    removeBlock(blockIndex) {
      applyChange(txWorkflowRemoveBlock(model, blockIndex));
    },
    setBlockSource(blockIndex, sourceKind) {
      applyChange(txWorkflowChangeBlockSource(model, blockIndex, sourceKind));
    },
    setInlineBlock(blockIndex, inlineBlock) {
      applyChange(txWorkflowUpdateInlineBlock(model, blockIndex, inlineBlock));
    },
    setRootFieldPresence(field, enabled) {
      applyChange(txWorkflowSetRootFieldPresence(model, field, enabled));
    },
    setRootValue(field, value) {
      applyChange(txWorkflowChangeRoot(model, field, value));
    },
    setTemplateRefFieldPresence(blockIndex, field, enabled) {
      applyChange(
        txWorkflowSetTemplateRefFieldPresence(
          model,
          blockIndex,
          field,
          enabled,
        ),
      );
    },
    setTemplateRefVarsPresence(blockIndex, enabled) {
      applyChange(
        txWorkflowSetTemplateRefVarsPresence(model, blockIndex, enabled),
      );
    },
  };
}

function txWorkflowBlockBindings(model, onChange, blockIndex) {
  const bindings = txWorkflowEditorBindings(model, onChange);
  return {
    patchTemplateRef(patch = {}) {
      bindings.patchTemplateRefBlock(blockIndex, patch);
    },
    remove() {
      bindings.removeBlock(blockIndex);
    },
    setSource(sourceKind) {
      bindings.setBlockSource(blockIndex, sourceKind);
    },
    setTemplateRefFieldPresence(field, enabled) {
      bindings.setTemplateRefFieldPresence(blockIndex, field, enabled);
    },
    setTemplateRefVarsPresence(enabled) {
      bindings.setTemplateRefVarsPresence(blockIndex, enabled);
    },
    updateInlineBlock(inlineBlock) {
      bindings.setInlineBlock(blockIndex, inlineBlock);
    },
  };
}

export function txWorkflowVisualEditorBindings(model, onChange) {
  const bindings = txWorkflowEditorBindings(model, onChange);
  return {
    appendBlock() {
      bindings.addBlock();
    },
    duplicateBlock(blockIndex) {
      bindings.duplicateBlock(blockIndex);
    },
    moveBlock(blockIndex, targetIndex) {
      bindings.moveBlock(blockIndex, targetIndex);
    },
    removeBlock(blockIndex) {
      bindings.removeBlock(blockIndex);
    },
    blockBindings(blockIndex) {
      return txWorkflowBlockBindings(model, onChange, blockIndex);
    },
    presenceToggle(field) {
      return callbackMappedFormCheckedHandler(
        (enabled) => bindings.setRootFieldPresence(field, enabled),
        (enabled) => enabled,
      );
    },
    valueHandler(field) {
      return callbackMappedFormValueHandler(
        (value) => bindings.setRootValue(field, value),
        (value) => value,
      );
    },
  };
}

export function txWorkflowBlockEditorBindings(
  blockRow = {},
  blockBindings = {},
) {
  return {
    templateRefBindings: txWorkflowTemplateRefEditorBindings(
      blockRow?.block?.templateRef,
      blockBindings,
    ),
  };
}

export function txWorkflowVisualEditorDisplay(model = {}) {
  const workflowValue = txPlainObject(model) ? model : {};
  return {
    blockRows: (Array.isArray(workflowValue.blocks)
      ? workflowValue.blocks
      : []
    ).map((block, blockIndex) => {
      const blockValue = txPlainObject(block) ? block : {};
      const isTemplateRef = blockValue.sourceKind === "template_ref";
      return {
        block: blockValue,
        blockIndex,
        fieldRows: txWorkflowBlockFieldsDisplay(blockValue),
        showInlineBlock: !isTemplateRef,
        showTemplateRef: isTemplateRef,
        titleText: `${t("txWorkflowFormBlock")} ${blockIndex + 1}`,
      };
    }),
    blockSourceRows: TX_WORKFLOW_BLOCK_SOURCE_ROWS,
    booleanRows: TX_BLOCK_BOOLEAN_ROWS,
    jsonValueTypeRows: TX_BLOCK_JSON_VALUE_TYPE_ROWS,
    rootFieldRows: txWorkflowRootFieldsDisplay(
      workflowValue,
      TX_BLOCK_BOOLEAN_ROWS,
    ),
  };
}

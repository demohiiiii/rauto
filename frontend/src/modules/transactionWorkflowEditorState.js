import {
  callbackMappedFormCheckedHandler,
  callbackMappedFormValueHandler,
} from "../lib/events.js";
import { plainObject, stringValue } from "../lib/jsonValue.js";
import { t } from "../lib/i18n.js";
import { selectOptionsWithCurrent } from "../lib/ui.js";
import {
  defaultTxBlockTemplatePayload,
  defaultTxWorkflowTemplateRefBlockPayload,
  txBlockFormModelFromJson,
  txWorkflowBlockFormModelFromJson,
  txWorkflowTemplateRefBlockModelFromJson,
} from "./transactionFormModels.js";
import {
  TX_WORKFLOW_INLINE_BLOCK_METADATA_FIELD_DEFS,
  TX_WORKFLOW_ROOT_METADATA_FIELD_DEFS,
  TX_WORKFLOW_TEMPLATE_REF_METADATA_FIELD_DEFS,
} from "./transactionStructure.js";
import {
  txExtraStringFieldRows,
  txExtraStringPresenceChangeHandler,
  txExtraStringValueChangeHandler,
  txSetExtraStringFieldPresence,
  txSetExtraStringFieldValue,
} from "./transactionMetadataFields.js";

const txPlainObject = plainObject;
const txStringValue = stringValue;

const TX_BLOCK_BOOLEAN_ROWS = Object.freeze(["true", "false"]);
const TX_BLOCK_JSON_VALUE_TYPE_ROWS = Object.freeze([
  "string",
  "number",
  "boolean",
  "null",
  "json",
]);
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

const TX_WORKFLOW_VISUAL_EDITOR_COVERAGE = Object.freeze({
  root: Object.freeze({
    component: "TxBlockRootSettingsEditor",
    scopes: Object.freeze(["root"]),
  }),
  rootExtra: Object.freeze({
    component: "JsonObjectFieldsEditor",
    scopes: Object.freeze(["root"]),
  }),
  blocks: Object.freeze({
    component: "TxWorkflowBlockEditor",
    scopes: Object.freeze([
      "block",
      "block.template_ref",
      "block.inline.root",
      "block.inline.step",
      "block.inline.operation.command",
      "block.inline.operation.command.interaction",
      "block.inline.operation.command.prompt",
      "block.inline.operation.flow",
      "block.inline.operation.flow.step",
      "block.inline.operation.template",
      "block.inline.operation.template.definition",
      "block.inline.operation.template.var",
      "block.inline.operation.template.step",
      "block.inline.operation.template.prompt",
      "block.inline.operation.template.runtime",
    ]),
  }),
});

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

function workflowApplyChange(onChange, nextModel) {
  return typeof onChange === "function" ? onChange(nextModel) : undefined;
}

function txWorkflowChangeRoot(model, key, value) {
  const next = workflowCloneModel(model);
  next[key] = key === "failFast" ? workflowBoolStringValue(value) : value;
  if (key === "failFast") next.hasFailFast = true;
  return next;
}

function txWorkflowAddBlock(model) {
  const next = workflowCloneModel(model);
  next.blocks.push(
    txWorkflowBlockFormModelFromJson(defaultTxBlockTemplatePayload()),
  );
  return next;
}

function txWorkflowRemoveBlock(model, blockIndex) {
  const next = workflowCloneModel(model);
  next.blocks.splice(blockIndex, 1);
  return next;
}

function txWorkflowChangeBlockSource(model, blockIndex, sourceKind) {
  const next = workflowCloneModel(model);
  const currentBlock =
    next.blocks[blockIndex] || txWorkflowBlockFormModelFromJson();
  next.blocks[blockIndex] = {
    sourceKind: sourceKind === "template_ref" ? "template_ref" : "inline",
    inlineBlock:
      currentBlock.inlineBlock ||
      txBlockFormModelFromJson(defaultTxBlockTemplatePayload()),
    templateRef:
      currentBlock.templateRef ||
      txWorkflowTemplateRefBlockModelFromJson(
        defaultTxWorkflowTemplateRefBlockPayload(),
      ),
  };
  return next;
}

function txWorkflowUpdateInlineBlock(model, blockIndex, inlineBlock) {
  const next = workflowCloneModel(model);
  const currentBlock =
    next.blocks[blockIndex] || txWorkflowBlockFormModelFromJson();
  next.blocks[blockIndex] = {
    ...currentBlock,
    inlineBlock,
  };
  return next;
}

function txWorkflowPatchTemplateRefBlock(model, blockIndex, patch = {}) {
  const next = workflowCloneModel(model);
  const currentBlock =
    next.blocks[blockIndex] || txWorkflowBlockFormModelFromJson();
  next.blocks[blockIndex] = {
    ...currentBlock,
    templateRef: {
      ...(currentBlock.templateRef ||
        txWorkflowTemplateRefBlockModelFromJson(
          defaultTxWorkflowTemplateRefBlockPayload(),
        )),
      ...patch,
    },
  };
  return next;
}

function txWorkflowPatchBlockMetadata(model, blockIndex, fieldKey, value) {
  const currentBlock =
    model &&
    Array.isArray(model.blocks) &&
    txPlainObject(model.blocks[blockIndex])
      ? model.blocks[blockIndex]
      : {};
  if (currentBlock.sourceKind === "template_ref") {
    const templateRef = txPlainObject(currentBlock.templateRef)
      ? currentBlock.templateRef
      : {};
    return txWorkflowPatchTemplateRefBlock(model, blockIndex, {
      extra: txSetExtraStringFieldValue(templateRef.extra, fieldKey, value),
    });
  }
  const inlineBlock = txPlainObject(currentBlock.inlineBlock)
    ? currentBlock.inlineBlock
    : {};
  return txWorkflowUpdateInlineBlock(model, blockIndex, {
    ...inlineBlock,
    extra: txSetExtraStringFieldValue(inlineBlock.extra, fieldKey, value),
  });
}

function txWorkflowSetBlockMetadataPresence(
  model,
  blockIndex,
  fieldKey,
  enabled,
) {
  const currentBlock =
    model &&
    Array.isArray(model.blocks) &&
    txPlainObject(model.blocks[blockIndex])
      ? model.blocks[blockIndex]
      : {};
  if (currentBlock.sourceKind === "template_ref") {
    const templateRef = txPlainObject(currentBlock.templateRef)
      ? currentBlock.templateRef
      : {};
    return txWorkflowPatchTemplateRefBlock(model, blockIndex, {
      extra: txSetExtraStringFieldPresence(
        templateRef.extra,
        fieldKey,
        enabled,
      ),
    });
  }
  const inlineBlock = txPlainObject(currentBlock.inlineBlock)
    ? currentBlock.inlineBlock
    : {};
  return txWorkflowUpdateInlineBlock(model, blockIndex, {
    ...inlineBlock,
    extra: txSetExtraStringFieldPresence(inlineBlock.extra, fieldKey, enabled),
  });
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

export function txWorkflowTemplateRefBindings(
  templateRef = {},
  { onPatch, onSetFieldPresence, onSetVarsPresence } = {},
) {
  const applyPatch = (patch = {}) =>
    typeof onPatch === "function" ? onPatch(patch) : undefined;
  return {
    setExtra(extra) {
      applyPatch({ extra });
    },
    setFailFast(value) {
      applyPatch({
        failFast: value === "true",
        hasFailFast: true,
      });
    },
    setFieldPresence(field, enabled) {
      return typeof onSetFieldPresence === "function"
        ? onSetFieldPresence(field, enabled)
        : undefined;
    },
    setNullableField(key, hasKey, value) {
      applyPatch({
        [key]: workflowNullableTextValue(value),
        [hasKey]: true,
      });
    },
    setNullableFieldMode(key, mode) {
      applyPatch(workflowNullableFieldModePatch(templateRef, key, mode));
    },
    setSourceMode(sourceMode) {
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
      );
    },
    setTemplateContent(value) {
      const nextValue = workflowNullableTextValue(value);
      applyPatch({
        txBlockTemplateContent: nextValue,
        hasTxBlockTemplateContent: true,
        ...(nextValue
          ? {
              txBlockTemplateName: null,
              hasTxBlockTemplateName: false,
            }
          : {}),
      });
    },
    setTemplateContentMode(mode) {
      applyPatch(
        workflowNullableFieldModePatch(
          templateRef,
          "txBlockTemplateContent",
          mode,
        ),
      );
    },
    setTemplateName(value) {
      const nextValue = workflowNullableTextValue(value);
      applyPatch({
        txBlockTemplateName: nextValue,
        hasTxBlockTemplateName: true,
        ...(nextValue
          ? {
              txBlockTemplateContent: null,
              hasTxBlockTemplateContent: false,
            }
          : {}),
      });
    },
    setTemplateNameMode(mode) {
      applyPatch(
        workflowNullableFieldModePatch(
          templateRef,
          "txBlockTemplateName",
          mode,
        ),
      );
    },
    setTemplateVars(txBlockTemplateVars) {
      applyPatch({
        txBlockTemplateVars,
        hasTxBlockTemplateVars: true,
      });
    },
    setVarsPresence(enabled) {
      return typeof onSetVarsPresence === "function"
        ? onSetVarsPresence(enabled)
        : undefined;
    },
  };
}

export function txWorkflowTemplateRefEditorBindings(
  templateRef = {},
  blockBindings = {},
) {
  const bindings = txWorkflowTemplateRefBindings(templateRef, {
    onPatch: (patch = {}) =>
      typeof blockBindings.patchTemplateRef === "function"
        ? blockBindings.patchTemplateRef(patch)
        : undefined,
    onSetFieldPresence: (field, enabled) =>
      typeof blockBindings.setTemplateRefFieldPresence === "function"
        ? blockBindings.setTemplateRefFieldPresence(field, enabled)
        : undefined,
    onSetVarsPresence: (enabled) =>
      typeof blockBindings.setTemplateRefVarsPresence === "function"
        ? blockBindings.setTemplateRefVarsPresence(enabled)
        : undefined,
  });
  return {
    ...bindings,
    presenceToggle(field) {
      return callbackMappedFormCheckedHandler(
        (enabled) => bindings.setFieldPresence(field, enabled),
        (enabled) => enabled,
      );
    },
    nullableModeHandler(fieldKey) {
      return callbackMappedFormValueHandler(
        (value) => bindings.setNullableFieldMode(fieldKey, value),
        (value) => value,
      );
    },
    valueHandler(fieldKey) {
      if (fieldKey === "failFast") {
        return callbackMappedFormValueHandler(
          bindings.setFailFast,
          (value) => value,
        );
      }
      return callbackMappedFormValueHandler(
        (value) => bindings.setNullableField("name", "hasName", value),
        (value) => value,
      );
    },
    sourceModeHandler() {
      return callbackMappedFormValueHandler(
        bindings.setSourceMode,
        (value) => value,
      );
    },
    templateContentHandler() {
      return callbackMappedFormValueHandler(
        bindings.setTemplateContent,
        (value) => value,
      );
    },
    templateContentModeHandler() {
      return callbackMappedFormValueHandler(
        bindings.setTemplateContentMode,
        (value) => value,
      );
    },
    templateNameHandler() {
      return callbackMappedFormValueHandler(
        bindings.setTemplateName,
        (value) => value,
      );
    },
    templateNameModeHandler() {
      return callbackMappedFormValueHandler(
        bindings.setTemplateNameMode,
        (value) => value,
      );
    },
    varsToggle() {
      return callbackMappedFormCheckedHandler(
        bindings.setVarsPresence,
        (enabled) => enabled,
      );
    },
  };
}

export function txWorkflowEditorBindings(model, onChange) {
  return {
    addBlock() {
      workflowApplyChange(onChange, txWorkflowAddBlock(model));
    },
    patchTemplateRefBlock(blockIndex, patch = {}) {
      workflowApplyChange(
        onChange,
        txWorkflowPatchTemplateRefBlock(model, blockIndex, patch),
      );
    },
    removeBlock(blockIndex) {
      workflowApplyChange(onChange, txWorkflowRemoveBlock(model, blockIndex));
    },
    setBlockMetadataPresence(blockIndex, fieldKey, enabled) {
      workflowApplyChange(
        onChange,
        txWorkflowSetBlockMetadataPresence(
          model,
          blockIndex,
          fieldKey,
          enabled,
        ),
      );
    },
    setBlockMetadataValue(blockIndex, fieldKey, value) {
      workflowApplyChange(
        onChange,
        txWorkflowPatchBlockMetadata(model, blockIndex, fieldKey, value),
      );
    },
    setBlockSource(blockIndex, sourceKind) {
      workflowApplyChange(
        onChange,
        txWorkflowChangeBlockSource(model, blockIndex, sourceKind),
      );
    },
    setInlineBlock(blockIndex, inlineBlock) {
      workflowApplyChange(
        onChange,
        txWorkflowUpdateInlineBlock(model, blockIndex, inlineBlock),
      );
    },
    setRootExtra(extra) {
      workflowApplyChange(
        onChange,
        txWorkflowChangeRoot(model, "extra", extra),
      );
    },
    setRootFieldPresence(field, enabled) {
      workflowApplyChange(
        onChange,
        txWorkflowSetRootFieldPresence(model, field, enabled),
      );
    },
    setRootValue(field, value) {
      workflowApplyChange(onChange, txWorkflowChangeRoot(model, field, value));
    },
    setTemplateRefFieldPresence(blockIndex, field, enabled) {
      workflowApplyChange(
        onChange,
        txWorkflowSetTemplateRefFieldPresence(
          model,
          blockIndex,
          field,
          enabled,
        ),
      );
    },
    setTemplateRefVarsPresence(blockIndex, enabled) {
      workflowApplyChange(
        onChange,
        txWorkflowSetTemplateRefVarsPresence(model, blockIndex, enabled),
      );
    },
  };
}

export function txWorkflowBlockBindings(model, onChange, blockIndex) {
  const bindings = txWorkflowEditorBindings(model, onChange);
  return {
    patchTemplateRef(patch = {}) {
      bindings.patchTemplateRefBlock(blockIndex, patch);
    },
    remove() {
      bindings.removeBlock(blockIndex);
    },
    setMetadataPresence(fieldKey, enabled) {
      bindings.setBlockMetadataPresence(blockIndex, fieldKey, enabled);
    },
    setMetadataValue(fieldKey, value) {
      bindings.setBlockMetadataValue(blockIndex, fieldKey, value);
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
    extraPresenceHandler(fieldKey) {
      return txExtraStringPresenceChangeHandler(
        bindings.setRootExtra,
        () => model?.extra,
        fieldKey,
      );
    },
    extraValueHandler(fieldKey) {
      return txExtraStringValueChangeHandler(
        bindings.setRootExtra,
        () => model?.extra,
        fieldKey,
      );
    },
    setRootExtra(extra) {
      bindings.setRootExtra(extra);
    },
  };
}

export function txWorkflowVisualEditorCoverage() {
  return TX_WORKFLOW_VISUAL_EDITOR_COVERAGE;
}

export function txWorkflowBlockEditorBindings(
  blockRow = {},
  blockBindings = {},
) {
  return {
    blockMetadataPresenceHandler(fieldKey) {
      return (enabled) =>
        typeof blockBindings.setMetadataPresence === "function"
          ? blockBindings.setMetadataPresence(fieldKey, enabled)
          : undefined;
    },
    blockMetadataValueHandler(fieldKey) {
      return (value) =>
        typeof blockBindings.setMetadataValue === "function"
          ? blockBindings.setMetadataValue(fieldKey, value)
          : undefined;
    },
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
      const metadataExtraSource = isTemplateRef
        ? txPlainObject(blockValue.templateRef)
          ? txPlainObject(blockValue.templateRef.extra)
            ? blockValue.templateRef.extra
            : {}
          : {}
        : txPlainObject(blockValue.inlineBlock)
          ? txPlainObject(blockValue.inlineBlock.extra)
            ? blockValue.inlineBlock.extra
            : {}
          : {};
      return {
        block: blockValue,
        blockIndex,
        fieldRows: txWorkflowBlockFieldsDisplay(blockValue),
        metadataExtraSource,
        metadataFieldRows: txExtraStringFieldRows(
          metadataExtraSource,
          isTemplateRef
            ? TX_WORKFLOW_TEMPLATE_REF_METADATA_FIELD_DEFS
            : TX_WORKFLOW_INLINE_BLOCK_METADATA_FIELD_DEFS,
        ),
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
    rootMetadataFieldRows: txExtraStringFieldRows(
      workflowValue.extra,
      TX_WORKFLOW_ROOT_METADATA_FIELD_DEFS,
    ),
    rootMetadataSource: txPlainObject(workflowValue.extra)
      ? workflowValue.extra
      : {},
  };
}

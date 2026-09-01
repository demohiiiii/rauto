import {
  callbackMappedFormCheckedHandler as callbackMappedFormCheckedHandlerBase,
  callbackMappedFormValueHandler as callbackMappedFormValueHandlerBase,
} from "../../../lib/events.js";
import { plainObject, stringValue } from "../../../lib/jsonValue.js";
import { t } from "../../../lib/i18n.js";
import { selectOptionsWithCurrent as selectOptionsWithCurrentBase } from "../../../lib/ui.js";
import {
  defaultTxBlockTemplatePayload,
  defaultTxWorkflowTemplateRefBlockPayload,
  txBlockFormModelFromJson,
  txWorkflowBlockFormModelFromJson,
  txWorkflowTemplateRefBlockModelFromJson,
} from "../model/transactionBlockFormModels.js";
import type {
  JsonObject,
  TxBlockFormModel,
  TxWorkflowBlockFormModel,
  TxWorkflowTemplateRefBlockModel,
} from "../model/types.js";
import {
  TX_BLOCK_BOOLEAN_ROWS,
  TX_BLOCK_JSON_VALUE_TYPE_ROWS,
} from "../presentation/transactionBlockDisplayState.js";

type FormEventHandler = (event: unknown) => unknown;
interface TxWorkflowEditorModel extends JsonObject {
  blocks?: TxWorkflowBlockFormModel[];
  failFast?: boolean;
  hasFailFast?: boolean;
}

interface TxWorkflowFieldDefinition {
  controlType: string;
  fieldKey: string;
  inputType?: string;
  labelKey: string;
  optionKind?: string;
  placeholderKey?: string;
}

interface TxWorkflowOptionRow {
  optionLabel: string;
  optionValue: string;
}

interface TxWorkflowFieldRow extends JsonObject {
  controlType: string;
  enabled: boolean;
  fieldKey: string;
  inputType?: string;
  labelText: string;
  nullableModeRows?: TxWorkflowOptionRow[];
  nullableModeValue?: string;
  optionRows?: TxWorkflowOptionRow[];
  placeholderText: string;
  showNullableModeSelect?: boolean;
  showPresenceToggle: boolean;
  valueText: string;
}

interface TxWorkflowBlockBindingPort {
  patchTemplateRef?(patch: JsonObject): unknown;
  setTemplateRefFieldPresence?(field: string, enabled: boolean): unknown;
  setTemplateRefVarsPresence?(enabled: boolean): unknown;
}

type TxWorkflowChangeHandler = (model: TxWorkflowEditorModel) => unknown;

const callbackMappedFormCheckedHandler =
  callbackMappedFormCheckedHandlerBase as unknown as (
    callback: (checked: boolean) => unknown,
    mapValue: (checked: boolean) => boolean,
  ) => FormEventHandler;
const callbackMappedFormValueHandler =
  callbackMappedFormValueHandlerBase as unknown as (
    callback: (value: unknown) => unknown,
    mapValue: (value: unknown) => unknown,
  ) => FormEventHandler;
const txPlainObject = plainObject as unknown as (
  value: unknown,
) => value is JsonObject;
const txStringValue = stringValue as unknown as (
  value: unknown,
  fallback?: string,
) => string;
const selectOptionsWithCurrent = selectOptionsWithCurrentBase as unknown as (
  options: readonly unknown[],
  currentValue: unknown,
) => string[];

function txWorkflowEditorModel(value: unknown): TxWorkflowEditorModel {
  return txPlainObject(value) ? (value as TxWorkflowEditorModel) : {};
}

function txWorkflowBlockModel(value: unknown): TxWorkflowBlockFormModel {
  return txPlainObject(value)
    ? (value as TxWorkflowBlockFormModel)
    : txWorkflowBlockFormModelFromJson();
}

const TX_WORKFLOW_BLOCK_SOURCE_ROWS = Object.freeze(["inline", "template_ref"]);
const TX_WORKFLOW_ROOT_FIELD_DEFS: readonly TxWorkflowFieldDefinition[] =
  Object.freeze([
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
const TX_WORKFLOW_BLOCK_FIELD_DEFS: readonly TxWorkflowFieldDefinition[] =
  Object.freeze([
    {
      controlType: "select",
      fieldKey: "sourceKind",
      labelKey: "txWorkflowFormBlockSource",
    },
  ]);
const TX_WORKFLOW_TEMPLATE_REF_FIELD_DEFS: readonly TxWorkflowFieldDefinition[] =
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
const TX_WORKFLOW_TEMPLATE_REF_SOURCE_MODE_ROWS = Object.freeze([
  "name",
  "content",
]);
const TX_WORKFLOW_NULLABLE_MODE_ROWS = Object.freeze([
  { value: "value", labelKey: "txBlockNullableModeValue" },
  { value: "null", labelKey: "txBlockNullableModeNull" },
]);

function workflowBoolStringValue(value: unknown): boolean {
  return value === "true" || value === true;
}

function workflowNullableTextValue(value: unknown): string | null {
  return value == null ? null : String(value);
}

function workflowNullableModeValue(value: unknown = ""): "null" | "value" {
  return value === "null" ? "null" : "value";
}

function workflowNullableModeRows() {
  return TX_WORKFLOW_NULLABLE_MODE_ROWS.map((optionRow) => ({
    optionLabel: t(optionRow.labelKey),
    optionValue: optionRow.value,
  }));
}

function workflowWithNullableMode(
  fieldDef: TxWorkflowFieldDefinition,
  sourceValue: JsonObject = {},
  fieldRow: TxWorkflowFieldRow,
): TxWorkflowFieldRow {
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
  model: unknown = {},
  field: string,
  mode: unknown,
  fallback: unknown = "",
): JsonObject {
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

function workflowToggleNullableFieldPresence(
  model: unknown = {},
  field: string,
  enabled: boolean,
): JsonObject {
  const value = txPlainObject(model) ? model : {};
  const hasKey = `has${field[0].toUpperCase()}${field.slice(1)}`;
  return {
    ...value,
    [field]: enabled ? (value[field] ?? "") : null,
    [hasKey]: enabled,
  };
}

function workflowToggleObjectFieldPresence(
  model: unknown = {},
  field: string,
  enabled: boolean,
): JsonObject {
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

function workflowCloneModel(model: unknown): TxWorkflowEditorModel {
  return structuredClone(txWorkflowEditorModel(model));
}

function txWorkflowUpdateBlock(
  model: unknown,
  blockIndex: number,
  updater: (block: TxWorkflowBlockFormModel) => TxWorkflowBlockFormModel,
): TxWorkflowEditorModel {
  const next = workflowCloneModel(model);
  if (!Array.isArray(next.blocks)) next.blocks = [];
  next.blocks[blockIndex] = updater(
    txWorkflowBlockModel(next.blocks[blockIndex]),
  );
  return next;
}

function workflowApplyChange(
  onChange: unknown,
  nextModel: TxWorkflowEditorModel,
): unknown {
  return typeof onChange === "function"
    ? (onChange as TxWorkflowChangeHandler)(nextModel)
    : undefined;
}

function txWorkflowChangeRoot(
  model: unknown,
  key: string,
  value: unknown,
): TxWorkflowEditorModel {
  const next = workflowCloneModel(model);
  next[key] = key === "failFast" ? workflowBoolStringValue(value) : value;
  if (key === "failFast") next.hasFailFast = true;
  return next;
}

export function txWorkflowAddBlock(model: unknown): TxWorkflowEditorModel {
  const next = workflowCloneModel(model);
  if (!Array.isArray(next.blocks)) next.blocks = [];
  next.blocks.push(
    txWorkflowBlockFormModelFromJson(defaultTxBlockTemplatePayload()),
  );
  return next;
}

export function txWorkflowRemoveBlock(
  model: unknown,
  blockIndex: number,
): TxWorkflowEditorModel {
  const next = workflowCloneModel(model);
  if (!Array.isArray(next.blocks)) next.blocks = [];
  next.blocks.splice(blockIndex, 1);
  return next;
}

export function txWorkflowDuplicateBlock(
  model: unknown,
  blockIndex: number,
): TxWorkflowEditorModel {
  const next = workflowCloneModel(model);
  if (!Array.isArray(next.blocks) || !next.blocks[blockIndex]) return next;
  next.blocks.splice(
    blockIndex + 1,
    0,
    structuredClone(next.blocks[blockIndex]),
  );
  return next;
}

export function txWorkflowMoveBlock(
  model: unknown,
  blockIndex: number,
  targetIndex: number,
): TxWorkflowEditorModel {
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

function txWorkflowChangeBlockSource(
  model: unknown,
  blockIndex: number,
  sourceKind: unknown,
): TxWorkflowEditorModel {
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

function txWorkflowUpdateInlineBlock(
  model: unknown,
  blockIndex: number,
  inlineBlock: TxBlockFormModel,
): TxWorkflowEditorModel {
  return txWorkflowUpdateBlock(model, blockIndex, (currentBlock) => ({
    ...currentBlock,
    inlineBlock,
  }));
}

function txWorkflowPatchTemplateRefBlock(
  model: unknown,
  blockIndex: number,
  patch: JsonObject = {},
): TxWorkflowEditorModel {
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

export function txWorkflowSetRootFieldPresence(
  model: unknown = {},
  field: string,
  enabled: boolean,
): TxWorkflowEditorModel {
  const next = workflowCloneModel(model);
  if (field === "failFast") {
    next.failFast = enabled ? !!next.failFast : true;
    next.hasFailFast = enabled;
  }
  return next;
}

export function txWorkflowSetTemplateRefFieldPresence(
  model: unknown,
  blockIndex: number,
  field: string,
  enabled: boolean,
): TxWorkflowEditorModel {
  const workflow = txWorkflowEditorModel(model);
  const currentBlock = txWorkflowBlockModel(workflow.blocks?.[blockIndex]);
  const templateRef = currentBlock.templateRef;
  let patch: Partial<TxWorkflowTemplateRefBlockModel>;
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
  model: unknown,
  blockIndex: number,
  enabled: boolean,
): TxWorkflowEditorModel {
  const workflow = txWorkflowEditorModel(model);
  const currentBlock = txWorkflowBlockModel(workflow.blocks?.[blockIndex]);
  const templateRef = currentBlock.templateRef;
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

export function txWorkflowRootFieldsDisplay(
  model: unknown = {},
  booleanRows: readonly unknown[] = [],
): TxWorkflowFieldRow[] {
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

export function txWorkflowBlockFieldsDisplay(
  block: unknown = {},
): TxWorkflowFieldRow[] {
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
  templateRef: unknown = {},
  booleanRows: readonly unknown[] = [],
): TxWorkflowFieldRow[] {
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

export function txWorkflowTemplateRefSourceDisplay(templateRef: unknown = {}) {
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

export function txWorkflowTemplateRefVarsDisplay(templateRef: unknown = {}) {
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
  templateRef: unknown = {},
  booleanRows: readonly unknown[] = [],
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
  templateRef: unknown = {},
  blockBindings: unknown = {},
) {
  const bindingPort = txPlainObject(blockBindings)
    ? (blockBindings as TxWorkflowBlockBindingPort)
    : {};
  const applyPatch = (patch: JsonObject = {}): unknown =>
    typeof bindingPort.patchTemplateRef === "function"
      ? bindingPort.patchTemplateRef(patch)
      : undefined;
  const setTemplateSource = (
    field: "txBlockTemplateContent" | "txBlockTemplateName",
    pairedField: "txBlockTemplateContent" | "txBlockTemplateName",
    value: unknown,
  ): void => {
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
    setExtra(extra: JsonObject): void {
      applyPatch({ extra });
    },
    setTemplateVars(txBlockTemplateVars: JsonObject): void {
      applyPatch({
        txBlockTemplateVars,
        hasTxBlockTemplateVars: true,
      });
    },
    presenceToggle(field: string): FormEventHandler {
      return callbackMappedFormCheckedHandler(
        (enabled) =>
          typeof bindingPort.setTemplateRefFieldPresence === "function"
            ? bindingPort.setTemplateRefFieldPresence(field, enabled)
            : undefined,
        (enabled) => enabled,
      );
    },
    nullableModeHandler(fieldKey: string): FormEventHandler {
      return callbackMappedFormValueHandler(
        (value) =>
          applyPatch(
            workflowNullableFieldModePatch(templateRef, fieldKey, value),
          ),
        (value) => value,
      );
    },
    valueHandler(fieldKey: string): FormEventHandler {
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
    sourceModeHandler(): FormEventHandler {
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
    templateContentHandler(): FormEventHandler {
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
    templateContentModeHandler(): FormEventHandler {
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
    templateNameHandler(): FormEventHandler {
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
    templateNameModeHandler(): FormEventHandler {
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
    varsToggle(): FormEventHandler {
      return callbackMappedFormCheckedHandler(
        (enabled) =>
          typeof bindingPort.setTemplateRefVarsPresence === "function"
            ? bindingPort.setTemplateRefVarsPresence(enabled)
            : undefined,
        (enabled) => enabled,
      );
    },
  };
}

function txWorkflowEditorBindings(model: unknown, onChange: unknown) {
  const applyChange = (nextModel: TxWorkflowEditorModel): unknown =>
    workflowApplyChange(onChange, nextModel);
  return {
    addBlock() {
      applyChange(txWorkflowAddBlock(model));
    },
    duplicateBlock(blockIndex: number): void {
      applyChange(txWorkflowDuplicateBlock(model, blockIndex));
    },
    moveBlock(blockIndex: number, targetIndex: number): void {
      applyChange(txWorkflowMoveBlock(model, blockIndex, targetIndex));
    },
    patchTemplateRefBlock(blockIndex: number, patch: JsonObject = {}): void {
      applyChange(txWorkflowPatchTemplateRefBlock(model, blockIndex, patch));
    },
    removeBlock(blockIndex: number): void {
      applyChange(txWorkflowRemoveBlock(model, blockIndex));
    },
    setBlockSource(blockIndex: number, sourceKind: unknown): void {
      applyChange(txWorkflowChangeBlockSource(model, blockIndex, sourceKind));
    },
    setInlineBlock(blockIndex: number, inlineBlock: TxBlockFormModel): void {
      applyChange(txWorkflowUpdateInlineBlock(model, blockIndex, inlineBlock));
    },
    setRootFieldPresence(field: string, enabled: boolean): void {
      applyChange(txWorkflowSetRootFieldPresence(model, field, enabled));
    },
    setRootValue(field: string, value: unknown): void {
      applyChange(txWorkflowChangeRoot(model, field, value));
    },
    setTemplateRefFieldPresence(
      blockIndex: number,
      field: string,
      enabled: boolean,
    ): void {
      applyChange(
        txWorkflowSetTemplateRefFieldPresence(
          model,
          blockIndex,
          field,
          enabled,
        ),
      );
    },
    setTemplateRefVarsPresence(blockIndex: number, enabled: boolean): void {
      applyChange(
        txWorkflowSetTemplateRefVarsPresence(model, blockIndex, enabled),
      );
    },
  };
}

function txWorkflowBlockBindings(
  model: unknown,
  onChange: unknown,
  blockIndex: number,
) {
  const bindings = txWorkflowEditorBindings(model, onChange);
  return {
    patchTemplateRef(patch: JsonObject = {}): void {
      bindings.patchTemplateRefBlock(blockIndex, patch);
    },
    remove() {
      bindings.removeBlock(blockIndex);
    },
    setSource(sourceKind: unknown): void {
      bindings.setBlockSource(blockIndex, sourceKind);
    },
    setTemplateRefFieldPresence(field: string, enabled: boolean): void {
      bindings.setTemplateRefFieldPresence(blockIndex, field, enabled);
    },
    setTemplateRefVarsPresence(enabled: boolean): void {
      bindings.setTemplateRefVarsPresence(blockIndex, enabled);
    },
    updateInlineBlock(inlineBlock: TxBlockFormModel): void {
      bindings.setInlineBlock(blockIndex, inlineBlock);
    },
  };
}

export function txWorkflowVisualEditorBindings(
  model: unknown,
  onChange: unknown,
) {
  const bindings = txWorkflowEditorBindings(model, onChange);
  return {
    appendBlock() {
      bindings.addBlock();
    },
    duplicateBlock(blockIndex: number): void {
      bindings.duplicateBlock(blockIndex);
    },
    moveBlock(blockIndex: number, targetIndex: number): void {
      bindings.moveBlock(blockIndex, targetIndex);
    },
    removeBlock(blockIndex: number): void {
      bindings.removeBlock(blockIndex);
    },
    blockBindings(blockIndex: number) {
      return txWorkflowBlockBindings(model, onChange, blockIndex);
    },
    presenceToggle(field: string): FormEventHandler {
      return callbackMappedFormCheckedHandler(
        (enabled) => bindings.setRootFieldPresence(field, enabled),
        (enabled) => enabled,
      );
    },
    valueHandler(field: string): FormEventHandler {
      return callbackMappedFormValueHandler(
        (value) => bindings.setRootValue(field, value),
        (value) => value,
      );
    },
  };
}

export function txWorkflowBlockEditorBindings(
  blockRow: unknown = {},
  blockBindings: unknown = {},
) {
  const blockRowValue = txPlainObject(blockRow) ? blockRow : {};
  const blockValue = txPlainObject(blockRowValue.block)
    ? blockRowValue.block
    : {};
  return {
    templateRefBindings: txWorkflowTemplateRefEditorBindings(
      blockValue.templateRef,
      blockBindings,
    ),
  };
}

export function txWorkflowVisualEditorDisplay(model: unknown = {}) {
  const workflowValue = txWorkflowEditorModel(model);
  return {
    blockRows: (Array.isArray(workflowValue.blocks)
      ? workflowValue.blocks
      : []
    ).map((block, blockIndex) => {
      const blockValue = txPlainObject(block)
        ? (block as TxWorkflowBlockFormModel)
        : ({} as TxWorkflowBlockFormModel);
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

import {
  derived as deriveStore,
  get as getStore,
  writable,
} from "svelte/store";
import { plainObject } from "../../../lib/jsonValue.js";
import { currentLanguageState } from "../../../lib/i18n.js";
import {
  txBlockEditorFormStateFromJsonText,
  txBlockFormModelFromJson,
  txBlockFormModelToJsonText,
} from "../model/transactionBlockFormModels.js";
import type {
  JsonObject,
  TxBlockFormModel,
  TxWorkflowFormModel,
} from "../model/types.js";
import {
  txWorkflowBlockEditorBindings,
  txWorkflowTemplateRefEditorDisplay,
  txWorkflowVisualEditorBindings,
  txWorkflowVisualEditorDisplay,
} from "./transactionWorkflowEditorState.js";

const txWorkflowEditorPlainObject = plainObject as unknown as (
  value: unknown,
) => value is JsonObject;

type TxWorkflowChangeHandler = (model: TxWorkflowFormModel) => unknown;
type TxWorkflowSourceChangeHandler = (source: string) => unknown;

interface TxWorkflowTemplateRefSourceState {
  formError: string;
  formModel: TxBlockFormModel;
}

interface TxWorkflowTemplateRefSourceWorkspaceOptions {
  onSourceChange?: TxWorkflowSourceChangeHandler | null;
}

interface TxWorkflowTemplateRefEditorWorkspaceOptions {
  initialBooleanRows?: unknown;
  initialTemplateRef?: unknown;
}

interface TxWorkflowVisualEditorWorkspaceOptions {
  model?: unknown;
  onChange?: TxWorkflowChangeHandler | null;
}

interface TxWorkflowBlockEditorWorkspaceOptions {
  blockActionHandlers?: unknown;
  blockRow?: unknown;
}

function txWorkflowTemplateRefSourceEditorState(
  sourceValue: unknown = "",
  currentFormModel: TxBlockFormModel | null = null,
): TxWorkflowTemplateRefSourceState {
  if (typeof sourceValue !== "string" || !sourceValue.trim()) {
    return {
      formError: "",
      formModel: currentFormModel || txBlockFormModelFromJson(),
    };
  }
  const nextState = txBlockEditorFormStateFromJsonText(
    sourceValue,
    currentFormModel,
  );
  return {
    formError: nextState.formError,
    formModel:
      nextState.formModel || currentFormModel || txBlockFormModelFromJson(),
  };
}

export function createTxWorkflowTemplateRefSourceWorkspace({
  onSourceChange = null,
}: TxWorkflowTemplateRefSourceWorkspaceOptions = {}) {
  const editorDisplayModeStore = writable<"form" | "json">("form");
  const formModelStore = writable<TxBlockFormModel>(txBlockFormModelFromJson());
  const formErrorStore = writable<string>("");

  const applyState = (nextState: TxWorkflowTemplateRefSourceState): void => {
    formModelStore.set(nextState.formModel);
    formErrorStore.set(nextState.formError || "");
  };

  return {
    editorDisplayModeStore,
    formErrorStore,
    formModelStore,
    handleFormChange(nextModel: TxBlockFormModel): void {
      formModelStore.set(nextModel);
      formErrorStore.set("");
      if (typeof onSourceChange === "function") {
        onSourceChange(txBlockFormModelToJsonText(nextModel));
      }
    },
    handleJsonChange(nextValue: unknown): void {
      if (typeof onSourceChange === "function") {
        onSourceChange(
          typeof nextValue === "string" ? nextValue : String(nextValue ?? ""),
        );
      }
      applyState(
        txWorkflowTemplateRefSourceEditorState(
          nextValue,
          getStore(formModelStore),
        ),
      );
    },
    selectEditorView(nextView: unknown): void {
      editorDisplayModeStore.set(nextView === "json" ? "json" : "form");
    },
    setSourceContext({
      sourceValue = "",
    }: { sourceValue?: unknown } = {}): void {
      applyState(
        txWorkflowTemplateRefSourceEditorState(
          sourceValue,
          getStore(formModelStore),
        ),
      );
    },
  };
}

export function createTxWorkflowTemplateRefEditorWorkspace({
  initialBooleanRows = [],
  initialTemplateRef = {},
}: TxWorkflowTemplateRefEditorWorkspaceOptions = {}) {
  const booleanRowsStateStore = writable<unknown[]>(
    Array.isArray(initialBooleanRows) ? initialBooleanRows : [],
  );
  const templateRefStateStore = writable<JsonObject>(
    txWorkflowEditorPlainObject(initialTemplateRef) ? initialTemplateRef : {},
  );
  const editorDisplayStateStore = deriveStore(
    [templateRefStateStore, booleanRowsStateStore, currentLanguageState],
    ([$templateRefStateStore, $booleanRowsStateStore, _currentLanguageState]) =>
      txWorkflowTemplateRefEditorDisplay(
        $templateRefStateStore,
        $booleanRowsStateStore,
      ),
  );

  return {
    editorDisplayStateStore,
    setTemplateRefEditorContext({
      booleanRows = [],
      templateRef = {},
    }: {
      booleanRows?: unknown;
      templateRef?: unknown;
    } = {}): void {
      booleanRowsStateStore.set(Array.isArray(booleanRows) ? booleanRows : []);
      templateRefStateStore.set(
        txWorkflowEditorPlainObject(templateRef) ? templateRef : {},
      );
    },
  };
}

export function createTxWorkflowVisualEditorWorkspace({
  model = {},
  onChange = null,
}: TxWorkflowVisualEditorWorkspaceOptions = {}) {
  const modelStateStore = writable<JsonObject>(
    txWorkflowEditorPlainObject(model) ? model : {},
  );
  const onChangeStateStore = writable<TxWorkflowChangeHandler | null>(onChange);
  const editorDisplayStateStore = deriveStore(
    [modelStateStore, currentLanguageState],
    ([$modelStateStore]) => txWorkflowVisualEditorDisplay($modelStateStore),
  );
  const workflowActionHandlersStateStore = deriveStore(
    [modelStateStore, onChangeStateStore],
    ([$modelStateStore, $onChangeStateStore]) =>
      txWorkflowVisualEditorBindings($modelStateStore, $onChangeStateStore),
  );
  const workflowRootFieldRowsStateStore = deriveStore(
    editorDisplayStateStore,
    ($editorDisplayStateStore) => $editorDisplayStateStore.rootFieldRows,
  );
  const blockRowsStateStore = deriveStore(
    editorDisplayStateStore,
    ($editorDisplayStateStore) => $editorDisplayStateStore.blockRows,
  );

  function setVisualEditorContext({
    model: nextModel = {},
    onChange: nextOnChange = null,
  }: TxWorkflowVisualEditorWorkspaceOptions = {}): void {
    modelStateStore.set(
      txWorkflowEditorPlainObject(nextModel) ? nextModel : {},
    );
    onChangeStateStore.set(nextOnChange);
  }

  return {
    blockRowsStateStore,
    editorDisplayStateStore,
    setVisualEditorContext,
    workflowActionHandlersStateStore,
    workflowRootFieldRowsStateStore,
  };
}

export function createTxWorkflowBlockEditorWorkspace({
  blockActionHandlers = {},
  blockRow = {},
}: TxWorkflowBlockEditorWorkspaceOptions = {}) {
  const blockActionHandlersStateStore = writable<JsonObject>(
    txWorkflowEditorPlainObject(blockActionHandlers) ? blockActionHandlers : {},
  );
  const blockRowStateStore = writable<JsonObject>(
    txWorkflowEditorPlainObject(blockRow) ? blockRow : {},
  );
  const editorActionHandlersStateStore = deriveStore(
    [blockRowStateStore, blockActionHandlersStateStore],
    ([$blockRowStateStore, $blockActionHandlersStateStore]) =>
      txWorkflowBlockEditorBindings(
        $blockRowStateStore,
        $blockActionHandlersStateStore,
      ),
  );

  function setBlockEditorContext({
    blockActionHandlers: nextBlockActionHandlers = {},
    blockRow: nextBlockRow = {},
  }: TxWorkflowBlockEditorWorkspaceOptions = {}): void {
    blockActionHandlersStateStore.set(
      txWorkflowEditorPlainObject(nextBlockActionHandlers)
        ? nextBlockActionHandlers
        : {},
    );
    blockRowStateStore.set(
      txWorkflowEditorPlainObject(nextBlockRow) ? nextBlockRow : {},
    );
  }

  return {
    blockRowStateStore,
    editorActionHandlersStateStore,
    setBlockEditorContext,
  };
}

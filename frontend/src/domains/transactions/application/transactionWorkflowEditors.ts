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
  txWorkflowTemplateRefBlockModelFromJson,
} from "../model/transactionBlockFormModels.js";
import type {
  JsonObject,
  TxBlockFormModel,
  TxWorkflowFormModel,
  TxWorkflowTemplateRefBlockModel,
} from "../model/types.js";
import {
  txWorkflowBlockEditorBindings,
  txWorkflowTemplateRefEditorDisplay,
  txWorkflowVisualEditorBindings,
  txWorkflowVisualEditorDisplay,
} from "./transactionWorkflowEditorState.js";
import type {
  TxWorkflowBlockActionHandlers,
  TxWorkflowBlockRow,
} from "./transactionWorkflowEditorState.js";

type TxWorkflowChangeHandler = (model: TxWorkflowFormModel) => void;
type TxWorkflowSourceChangeHandler = (source: string) => void;

interface TxWorkflowTemplateRefSourceState {
  formError: string;
  formModel: TxBlockFormModel;
}

interface TxWorkflowTemplateRefSourceWorkspaceOptions {
  onSourceChange?: TxWorkflowSourceChangeHandler | null;
}

interface TxWorkflowTemplateRefEditorWorkspaceOptions {
  initialBooleanRows?: readonly string[];
  initialTemplateRef?: TxWorkflowTemplateRefBlockModel;
}

interface TxWorkflowVisualEditorWorkspaceOptions {
  model?: unknown;
  onChange?: TxWorkflowChangeHandler | null;
}

interface TxWorkflowBlockEditorWorkspaceOptions {
  blockActionHandlers?: TxWorkflowBlockActionHandlers | null;
  blockRow?: TxWorkflowBlockRow | null;
}

function txWorkflowTemplateRefSourceEditorState(
  sourceValue = "",
  currentFormModel: TxBlockFormModel | null = null,
): TxWorkflowTemplateRefSourceState {
  if (!sourceValue.trim()) {
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
    handleJsonChange(nextValue: string): void {
      if (typeof onSourceChange === "function") {
        onSourceChange(nextValue);
      }
      applyState(
        txWorkflowTemplateRefSourceEditorState(
          nextValue,
          getStore(formModelStore),
        ),
      );
    },
    selectEditorView(nextView: string): void {
      editorDisplayModeStore.set(nextView === "json" ? "json" : "form");
    },
    setSourceContext({
      sourceValue = "",
    }: { sourceValue?: string } = {}): void {
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
  initialTemplateRef = txWorkflowTemplateRefBlockModelFromJson(),
}: TxWorkflowTemplateRefEditorWorkspaceOptions = {}) {
  const booleanRowsStateStore = writable<string[]>([...initialBooleanRows]);
  const templateRefStateStore =
    writable<TxWorkflowTemplateRefBlockModel>(initialTemplateRef);
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
      templateRef = txWorkflowTemplateRefBlockModelFromJson(),
    }: {
      booleanRows?: readonly string[];
      templateRef?: TxWorkflowTemplateRefBlockModel;
    } = {}): void {
      booleanRowsStateStore.set([...booleanRows]);
      templateRefStateStore.set(templateRef);
    },
  };
}

export function createTxWorkflowVisualEditorWorkspace({
  model = {},
  onChange = null,
}: TxWorkflowVisualEditorWorkspaceOptions = {}) {
  const modelStateStore = writable<JsonObject>(plainObject(model) ? model : {});
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
    modelStateStore.set(plainObject(nextModel) ? nextModel : {});
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
  blockActionHandlers = null,
  blockRow = null,
}: TxWorkflowBlockEditorWorkspaceOptions = {}) {
  const blockActionHandlersStateStore =
    writable<TxWorkflowBlockActionHandlers | null>(blockActionHandlers);
  const blockRowStateStore = writable<TxWorkflowBlockRow | null>(blockRow);
  const editorActionHandlersStateStore = deriveStore(
    [blockRowStateStore, blockActionHandlersStateStore],
    ([$blockRowStateStore, $blockActionHandlersStateStore]) =>
      txWorkflowBlockEditorBindings(
        $blockRowStateStore,
        $blockActionHandlersStateStore || {},
      ),
  );

  function setBlockEditorContext({
    blockActionHandlers: nextBlockActionHandlers = null,
    blockRow: nextBlockRow = null,
  }: TxWorkflowBlockEditorWorkspaceOptions = {}): void {
    blockActionHandlersStateStore.set(nextBlockActionHandlers);
    blockRowStateStore.set(nextBlockRow);
  }

  return {
    blockRowStateStore,
    editorActionHandlersStateStore,
    setBlockEditorContext,
  };
}

import { derived as deriveStore, writable } from "svelte/store";
import type { Readable } from "svelte/store";

import { currentLanguageState } from "../../../lib/i18n.js";
import { safeString as safeTemplateString } from "../../../lib/ui.js";
import {
  defaultTxBlockTemplatePayload,
  txBlockFormModelFromJson,
  txBlockFormModelToJsonText,
} from "../model/transactionBlockFormModels.js";
import {
  defaultTxWorkflowTemplatePayload,
  txWorkflowFormModelFromJson,
  txWorkflowFormModelToJsonText,
} from "../model/transactionWorkflowFormModels.js";
import {
  createTxInputLoadingKeysStore,
  createTxInputPanelActionWorkspace,
  createTxInputPanelWorkspace,
  saveTxBlockEditorFormModel,
  saveTxWorkflowEditorFormModel,
  txBlockInputEditorSurfaceDisplay,
  txBlockInputEditorSyncState,
  txBlockInputFormState,
  txBlockInputPanelDisplay,
  txBlockJsonPlaceholder,
  txTemplateRunActionHandlers,
  txTemplateRunPanelDisplay,
  txWorkflowInputEditorSurfaceDisplay,
  txWorkflowInputEditorSyncState,
  txWorkflowInputFormState,
  txWorkflowInputPanelDisplay,
  txWorkflowJsonPlaceholder,
  jsonTemplateNameValue,
} from "./transactionInputState.js";
import {
  jsonTemplateSelectStateFor,
  setJsonTemplateSelectValue,
} from "./transactionPanelState.js";
import {
  setTxVarsRawText,
  txVarsTextStateFor,
} from "./transactionVarsAssistant.js";

import type {
  JsonErrorDetail,
  TransactionEditorView,
  TransactionParsedFormState,
  TransactionTemplateResource,
  TxBlockFormModel,
  TxWorkflowFormModel,
} from "../model/types.js";
import type { TextFile, TxInputDependencies } from "./transactionInputState.js";

type MaybePromise<T> = T | Promise<T>;
type InputActionResult = TransactionTemplateResource | null | void;
type InputDependencyState<TFile = TextFile> = Required<
  TxInputDependencies<TFile, InputActionResult>
>;
type TemplateAction = () => MaybePromise<void>;
type TemplateLoadAction = (templateName: string) => MaybePromise<void>;

interface TransactionInputState<TFile = TextFile> extends TxInputDependencies<
  TFile,
  InputActionResult
> {
  ariaLabel?: string;
  getDisplayConfig?: (() => { newButtonLabelKey?: string } | null) | null;
  getTemplateKind?: (() => string) | null;
  getVarsKey?: (() => string) | null;
  hintKeys?: string[];
  newButtonLabelKey?: string;
  onCreateTemplateDraft?: TemplateAction | null;
  onDeleteTemplate?: TemplateAction | null;
  onLoadTemplate?: TemplateLoadAction | null;
  onSaveTemplate?: TemplateAction | null;
  varsPlaceholderFallback?: string;
  varsPlaceholderKey?: string;
}

interface TemplatePanelConfig {
  ariaLabel?: string;
  hintKeys?: string[];
  varsPlaceholderFallback?: string;
  varsPlaceholderKey?: string;
}

interface TemplatePanelDependencyState {
  getTemplateKind: (() => string) | null;
  getVarsKey: (() => string) | null;
  onCreateTemplateDraft: TemplateAction | null;
  onDeleteTemplate: TemplateAction | null;
  onLoadTemplate: TemplateLoadAction | null;
  onSaveTemplate: TemplateAction | null;
}

interface TemplatePanelDisplayConfig {
  ariaLabel: string;
  hintKeys: string[];
  varsPlaceholderFallback: string;
  varsPlaceholderKey: string;
}

interface InputEditorSyncState<
  TModel,
  TErrorDetail,
> extends TransactionParsedFormState<TModel, TErrorDetail> {
  jsonText: string;
}

interface ConfiguredInputPanelOptions<
  TModel,
  TErrorDetail,
  TPanelDisplay,
  TEditorDisplay,
  TFile,
> {
  applyPanelContext?: ((state: TransactionInputState<TFile>) => void) | null;
  buildDefaultFormModel(): TModel;
  editorDisplayFromPanel(panel: TPanelDisplay): TEditorDisplay;
  formModelToJsonText(model: TModel): string;
  inputEditorSyncState(
    model: TModel,
  ): InputEditorSyncState<TModel, TErrorDetail>;
  inputFormStateFromJsonText(
    jsonText: string,
    model: TModel,
  ): TransactionParsedFormState<TModel, TErrorDetail>;
  inputState?: TransactionInputState<TFile>;
  panelDisplayStateStore: Readable<TPanelDisplay>;
  saveEditorFormModel(model: TModel, options?: { notify?: boolean }): void;
}

export function createTxTemplateRunPanelWorkspace(
  inputState: TransactionInputState<TextFile> = {},
) {
  const dependencyState: TemplatePanelDependencyState = {
    getTemplateKind:
      typeof inputState.getTemplateKind === "function"
        ? inputState.getTemplateKind
        : null,
    getVarsKey:
      typeof inputState.getVarsKey === "function"
        ? inputState.getVarsKey
        : null,
    onCreateTemplateDraft: inputState.onCreateTemplateDraft ?? null,
    onDeleteTemplate: inputState.onDeleteTemplate ?? null,
    onLoadTemplate: inputState.onLoadTemplate ?? null,
    onSaveTemplate: inputState.onSaveTemplate ?? null,
  };
  const { loadingKeysStore, loadingRunner } = createTxInputLoadingKeysStore();
  const templateSelectStateStore = jsonTemplateSelectStateFor(
    typeof dependencyState.getTemplateKind === "function"
      ? dependencyState.getTemplateKind()
      : "",
  );
  const varsTextStateStore = txVarsTextStateFor(
    typeof dependencyState.getVarsKey === "function"
      ? dependencyState.getVarsKey()
      : "",
  );
  const loadingStateStore = deriveStore(
    loadingKeysStore,
    ($loadingKeysStore) => {
      const nextLoadingKeys = Array.isArray($loadingKeysStore)
        ? $loadingKeysStore
        : [];
      return {
        deleteTemplateLoading: nextLoadingKeys.includes("template-delete"),
        loadTemplateLoading: nextLoadingKeys.includes("template-load"),
        newTemplateLoading: nextLoadingKeys.includes("template-new"),
        saveTemplateLoading: nextLoadingKeys.includes("template-save"),
      };
    },
  );
  const editorDisplayModeStateStore = writable<"form" | "json">("form");
  const panelDisplayConfigStateStore = writable<TemplatePanelDisplayConfig>({
    ariaLabel: "",
    hintKeys: [],
    varsPlaceholderFallback: "",
    varsPlaceholderKey: "",
  });
  const localizedPanelDisplayStateStore = deriveStore(
    [
      templateSelectStateStore,
      varsTextStateStore,
      panelDisplayConfigStateStore,
      currentLanguageState,
    ],
    ([
      $templateSelectStateStore,
      $varsTextStateStore,
      $panelDisplayConfigStateStore,
    ]) =>
      txTemplateRunPanelDisplay({
        ...($panelDisplayConfigStateStore || {}),
        templateSelectState: $templateSelectStateStore,
        varsTextState: $varsTextStateStore,
      }),
  );

  function changeVarsText(varsText = ""): void {
    const varsKey =
      typeof dependencyState.getVarsKey === "function"
        ? dependencyState.getVarsKey()
        : "";
    setTxVarsRawText(varsKey, varsText, { source: "editor" });
  }

  async function loadTemplate(selectedTemplate: string) {
    const templateKind =
      typeof dependencyState.getTemplateKind === "function"
        ? dependencyState.getTemplateKind()
        : "";
    const nextTemplate = jsonTemplateNameValue(selectedTemplate);
    setJsonTemplateSelectValue(templateKind, nextTemplate);
    if (!nextTemplate || typeof dependencyState.onLoadTemplate !== "function") {
      return;
    }
    const onLoadTemplate = dependencyState.onLoadTemplate;
    return loadingRunner.run("template-load", () =>
      onLoadTemplate?.(nextTemplate),
    );
  }

  function createTemplateDraft() {
    return loadingRunner.run("template-new", () =>
      dependencyState.onCreateTemplateDraft?.(),
    );
  }

  function saveTemplate() {
    return loadingRunner.run("template-save", () =>
      dependencyState.onSaveTemplate?.(),
    );
  }

  function deleteTemplate() {
    return loadingRunner.run("template-delete", () =>
      dependencyState.onDeleteTemplate?.(),
    );
  }

  function selectEditorView(nextView: TransactionEditorView = "form"): void {
    editorDisplayModeStateStore.set(nextView === "json" ? "json" : "form");
  }

  function applyPanelConfig(nextConfig: TemplatePanelConfig = {}): void {
    panelDisplayConfigStateStore.set({
      ariaLabel: nextConfig.ariaLabel ?? "",
      hintKeys: nextConfig.hintKeys ?? [],
      varsPlaceholderFallback: nextConfig.varsPlaceholderFallback ?? "",
      varsPlaceholderKey: nextConfig.varsPlaceholderKey ?? "",
    });
  }

  function applyDependencyInputs(
    nextInputState: TransactionInputState<TextFile> = {},
  ): void {
    if ("getTemplateKind" in nextInputState) {
      dependencyState.getTemplateKind =
        typeof nextInputState.getTemplateKind === "function"
          ? nextInputState.getTemplateKind
          : dependencyState.getTemplateKind;
    }
    if ("getVarsKey" in nextInputState) {
      dependencyState.getVarsKey =
        typeof nextInputState.getVarsKey === "function"
          ? nextInputState.getVarsKey
          : dependencyState.getVarsKey;
    }
    if ("onCreateTemplateDraft" in nextInputState) {
      dependencyState.onCreateTemplateDraft =
        nextInputState.onCreateTemplateDraft ?? null;
    }
    if ("onDeleteTemplate" in nextInputState) {
      dependencyState.onDeleteTemplate =
        nextInputState.onDeleteTemplate ?? null;
    }
    if ("onLoadTemplate" in nextInputState) {
      dependencyState.onLoadTemplate = nextInputState.onLoadTemplate ?? null;
    }
    if ("onSaveTemplate" in nextInputState) {
      dependencyState.onSaveTemplate = nextInputState.onSaveTemplate ?? null;
    }
  }

  function setTemplateRunPanelContext(
    nextContext: TransactionInputState<TextFile> = {},
  ): void {
    applyPanelConfig(nextContext);
    applyDependencyInputs(nextContext);
  }

  function templateChangeHandler() {
    return txTemplateRunActionHandlers({
      onTemplateChange: loadTemplate,
    }).templateChangeHandler();
  }

  return {
    changeVarsText,
    createTemplateDraft,
    deleteTemplate,
    editorDisplayModeStateStore,
    loadTemplate,
    loadingStateStore,
    panelDisplayStateStore: localizedPanelDisplayStateStore,
    saveTemplate,
    selectEditorView,
    setTemplateRunPanelContext,
    templateChangeHandler,
    templateSelectStateStore,
    varsTextStateStore,
  };
}

function txInputDependencyState<TFile>(
  inputState: TransactionInputState<TFile> = {},
): InputDependencyState<TFile> {
  return {
    onCreateDirectDraft: inputState.onCreateDirectDraft ?? null,
    onCreateJsonTemplateDraft: inputState.onCreateJsonTemplateDraft ?? null,
    onDirectMode: inputState.onDirectMode ?? null,
    onEditorInput: inputState.onEditorInput ?? null,
    onImportFile: inputState.onImportFile ?? null,
    onLoadJsonTemplate: inputState.onLoadJsonTemplate ?? null,
    onTemplateMode: inputState.onTemplateMode ?? null,
  };
}

function updateTxInputDependencies<TFile>(
  dependencyState: InputDependencyState<TFile>,
  nextInputState: TransactionInputState<TFile> = {},
): void {
  if ("onCreateDirectDraft" in nextInputState) {
    dependencyState.onCreateDirectDraft =
      nextInputState.onCreateDirectDraft ?? null;
  }
  if ("onCreateJsonTemplateDraft" in nextInputState) {
    dependencyState.onCreateJsonTemplateDraft =
      nextInputState.onCreateJsonTemplateDraft ?? null;
  }
  if ("onDirectMode" in nextInputState) {
    dependencyState.onDirectMode = nextInputState.onDirectMode ?? null;
  }
  if ("onEditorInput" in nextInputState) {
    dependencyState.onEditorInput = nextInputState.onEditorInput ?? null;
  }
  if ("onImportFile" in nextInputState) {
    dependencyState.onImportFile = nextInputState.onImportFile ?? null;
  }
  if ("onLoadJsonTemplate" in nextInputState) {
    dependencyState.onLoadJsonTemplate =
      nextInputState.onLoadJsonTemplate ?? null;
  }
  if ("onTemplateMode" in nextInputState) {
    dependencyState.onTemplateMode = nextInputState.onTemplateMode ?? null;
  }
}

function createConfiguredTxInputPanelWorkspace<
  TModel,
  TErrorDetail,
  TPanelDisplay,
  TEditorDisplay,
  TFile,
>({
  applyPanelContext = null,
  buildDefaultFormModel,
  editorDisplayFromPanel,
  formModelToJsonText,
  inputEditorSyncState,
  inputFormStateFromJsonText,
  inputState = {},
  panelDisplayStateStore,
  saveEditorFormModel,
}: ConfiguredInputPanelOptions<
  TModel,
  TErrorDetail,
  TPanelDisplay,
  TEditorDisplay,
  TFile
>) {
  const dependencyState = txInputDependencyState(inputState);
  const txInputWorkspace = createTxInputPanelWorkspace({
    buildDefaultFormModel,
    formModelToJsonText,
    inputEditorSyncState,
    inputFormStateFromJsonText,
    saveEditorFormModel,
  });
  const editorDisplayStateStore = deriveStore(
    panelDisplayStateStore,
    editorDisplayFromPanel,
  );
  const actionWorkspace = createTxInputPanelActionWorkspace(
    txInputWorkspace,
    dependencyState,
  );

  function setInputPanelContext(
    nextInputState: TransactionInputState<TFile> = {},
  ): void {
    if (typeof applyPanelContext === "function") {
      applyPanelContext(nextInputState);
    }
    updateTxInputDependencies(dependencyState, nextInputState);
  }

  return {
    editorDisplayStateStore,
    panelDisplayStateStore,
    setInputPanelContext,
    ...txInputWorkspace,
    ...actionWorkspace,
  };
}

export function createTxBlockInputPanelWorkspace<TFile = TextFile>(
  inputState: TransactionInputState<TFile> = {},
) {
  const panelConfigStateStore = writable({
    newButtonLabelKey: safeTemplateString(
      inputState.newButtonLabelKey ||
        (typeof inputState.getDisplayConfig === "function"
          ? inputState.getDisplayConfig()?.newButtonLabelKey
          : ""),
    ),
  });
  const panelDisplayStateStore = deriveStore(
    [panelConfigStateStore, currentLanguageState],
    ([$panelConfigStateStore, _currentLanguageState]) =>
      txBlockInputPanelDisplay({
        jsonPlaceholder: txBlockJsonPlaceholder,
        newButtonLabelKey: $panelConfigStateStore.newButtonLabelKey || "newBtn",
      }),
  );
  const { setInputPanelContext, ...workspace } =
    createConfiguredTxInputPanelWorkspace<
      TxBlockFormModel,
      JsonErrorDetail,
      ReturnType<typeof txBlockInputPanelDisplay>,
      ReturnType<typeof txBlockInputEditorSurfaceDisplay>,
      TFile
    >({
      applyPanelContext(nextInputState: TransactionInputState<TFile>) {
        if (!("newButtonLabelKey" in nextInputState)) return;
        panelConfigStateStore.update((currentConfig) => ({
          ...currentConfig,
          newButtonLabelKey: safeTemplateString(
            nextInputState.newButtonLabelKey,
          ),
        }));
      },
      buildDefaultFormModel: () =>
        txBlockFormModelFromJson(defaultTxBlockTemplatePayload()),
      editorDisplayFromPanel: txBlockInputEditorSurfaceDisplay,
      formModelToJsonText: txBlockFormModelToJsonText,
      inputEditorSyncState: txBlockInputEditorSyncState,
      inputFormStateFromJsonText: txBlockInputFormState,
      inputState,
      panelDisplayStateStore,
      saveEditorFormModel: saveTxBlockEditorFormModel,
    });

  return {
    ...workspace,
    setBlockInputPanelContext: setInputPanelContext,
  };
}

export function createTxWorkflowInputPanelWorkspace<TFile = TextFile>(
  inputState: TransactionInputState<TFile> = {},
) {
  const panelDisplayStateStore = deriveStore(currentLanguageState, () =>
    txWorkflowInputPanelDisplay({
      jsonPlaceholder: txWorkflowJsonPlaceholder,
    }),
  );
  const { setInputPanelContext, ...workspace } =
    createConfiguredTxInputPanelWorkspace<
      TxWorkflowFormModel,
      JsonErrorDetail,
      ReturnType<typeof txWorkflowInputPanelDisplay>,
      ReturnType<typeof txWorkflowInputEditorSurfaceDisplay>,
      TFile
    >({
      buildDefaultFormModel: () =>
        txWorkflowFormModelFromJson(defaultTxWorkflowTemplatePayload()),
      editorDisplayFromPanel: txWorkflowInputEditorSurfaceDisplay,
      formModelToJsonText: txWorkflowFormModelToJsonText,
      inputEditorSyncState: txWorkflowInputEditorSyncState,
      inputFormStateFromJsonText: txWorkflowInputFormState,
      inputState,
      panelDisplayStateStore,
      saveEditorFormModel: saveTxWorkflowEditorFormModel,
    });

  return {
    ...workspace,
    handleWorkflowEditorInput: workspace.handleEditorJsonInput,
    setWorkflowInputPanelContext: setInputPanelContext,
  };
}

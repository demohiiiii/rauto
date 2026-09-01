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
  normalizeOptionalHandler,
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
  TransactionParsedFormState,
  TxBlockFormModel,
  TxWorkflowFormModel,
} from "../model/types.js";

type OptionalHandler = (...args: unknown[]) => unknown;
type InputDependencyState = Record<string, OptionalHandler | null>;

interface TransactionInputState extends Record<string, unknown> {
  getDisplayConfig?: (() => { newButtonLabelKey?: unknown } | null) | null;
  getTemplateKind?: (() => string) | null;
  getVarsKey?: (() => string) | null;
  newButtonLabelKey?: unknown;
  onCreateTemplateDraft?: unknown;
  onDeleteTemplate?: unknown;
  onLoadTemplate?: unknown;
  onSaveTemplate?: unknown;
}

interface TemplatePanelConfig extends Record<string, unknown> {
  ariaLabel?: unknown;
  hintKeys?: unknown;
  varsPlaceholderFallback?: unknown;
  varsPlaceholderKey?: unknown;
}

interface TemplatePanelDependencyState {
  getTemplateKind: (() => string) | null;
  getVarsKey: (() => string) | null;
  onCreateTemplateDraft: OptionalHandler | null;
  onDeleteTemplate: OptionalHandler | null;
  onLoadTemplate: OptionalHandler | null;
  onSaveTemplate: OptionalHandler | null;
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
> {
  applyPanelContext?: ((state: TransactionInputState) => unknown) | null;
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
  inputState?: TransactionInputState;
  panelDisplayStateStore: Readable<TPanelDisplay>;
  saveEditorFormModel(model: TModel, options?: { notify?: boolean }): unknown;
}

const optionalHandler = (handler: unknown): OptionalHandler | null =>
  normalizeOptionalHandler(handler) as OptionalHandler | null;
const inputText = (value: unknown): string => safeTemplateString(value);

export function createTxTemplateRunPanelWorkspace(
  inputState: TransactionInputState = {},
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
    onCreateTemplateDraft: optionalHandler(inputState.onCreateTemplateDraft),
    onDeleteTemplate: optionalHandler(inputState.onDeleteTemplate),
    onLoadTemplate: optionalHandler(inputState.onLoadTemplate),
    onSaveTemplate: optionalHandler(inputState.onSaveTemplate),
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
        templateSelectState:
          $templateSelectStateStore as unknown as NonNullable<
            Parameters<typeof txTemplateRunPanelDisplay>[0]
          >["templateSelectState"],
        varsTextState: $varsTextStateStore as NonNullable<
          Parameters<typeof txTemplateRunPanelDisplay>[0]
        >["varsTextState"],
      }),
  );

  function changeVarsText(varsText: unknown = ""): void {
    const varsKey =
      typeof dependencyState.getVarsKey === "function"
        ? dependencyState.getVarsKey()
        : "";
    setTxVarsRawText(varsKey, inputText(varsText), { source: "editor" });
  }

  async function loadTemplate(selectedTemplate: unknown) {
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

  function selectEditorView(nextView: unknown = ""): void {
    editorDisplayModeStateStore.set(nextView === "json" ? "json" : "form");
  }

  function applyPanelConfig(nextConfig: TemplatePanelConfig = {}): void {
    panelDisplayConfigStateStore.set({
      ariaLabel: safeTemplateString(nextConfig.ariaLabel),
      hintKeys: Array.isArray(nextConfig.hintKeys)
        ? nextConfig.hintKeys.map(inputText)
        : [],
      varsPlaceholderFallback: safeTemplateString(
        nextConfig.varsPlaceholderFallback,
      ),
      varsPlaceholderKey: safeTemplateString(nextConfig.varsPlaceholderKey),
    });
  }

  function applyDependencyInputs(
    nextInputState: TransactionInputState = {},
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
      dependencyState.onCreateTemplateDraft = optionalHandler(
        nextInputState.onCreateTemplateDraft,
      );
    }
    if ("onDeleteTemplate" in nextInputState) {
      dependencyState.onDeleteTemplate = optionalHandler(
        nextInputState.onDeleteTemplate,
      );
    }
    if ("onLoadTemplate" in nextInputState) {
      dependencyState.onLoadTemplate = optionalHandler(
        nextInputState.onLoadTemplate,
      );
    }
    if ("onSaveTemplate" in nextInputState) {
      dependencyState.onSaveTemplate = optionalHandler(
        nextInputState.onSaveTemplate,
      );
    }
  }

  function setTemplateRunPanelContext(
    nextContext: TransactionInputState = {},
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

const TX_INPUT_DEPENDENCY_KEYS = [
  "onCreateDirectDraft",
  "onCreateJsonTemplateDraft",
  "onEditorInput",
  "onImportFile",
  "onLoadJsonTemplate",
] as const;

function txInputDependencyState(
  inputState: TransactionInputState = {},
): InputDependencyState {
  return Object.fromEntries(
    TX_INPUT_DEPENDENCY_KEYS.map((key) => [
      key,
      optionalHandler(inputState[key]),
    ]),
  );
}

function updateTxInputDependencies(
  dependencyState: InputDependencyState,
  nextInputState: TransactionInputState = {},
): void {
  for (const key of TX_INPUT_DEPENDENCY_KEYS) {
    if (key in nextInputState) {
      dependencyState[key] = optionalHandler(nextInputState[key]);
    }
  }
}

function createConfiguredTxInputPanelWorkspace<
  TModel,
  TErrorDetail,
  TPanelDisplay,
  TEditorDisplay,
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
  TEditorDisplay
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
    nextInputState: TransactionInputState = {},
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

export function createTxBlockInputPanelWorkspace(
  inputState: TransactionInputState = {},
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
    createConfiguredTxInputPanelWorkspace({
      applyPanelContext(nextInputState: TransactionInputState) {
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

export function createTxWorkflowInputPanelWorkspace(
  inputState: TransactionInputState = {},
) {
  const panelDisplayStateStore = deriveStore(currentLanguageState, () =>
    txWorkflowInputPanelDisplay({
      jsonPlaceholder: txWorkflowJsonPlaceholder,
    }),
  );
  const { setInputPanelContext, ...workspace } =
    createConfiguredTxInputPanelWorkspace({
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

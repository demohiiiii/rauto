import {
  derived as deriveStore,
  get as getStore,
  writable,
} from "svelte/store";
import { currentLanguageState } from "../../../lib/i18n.js";
import {
  orchestrationPlanFormModelFromJson,
  orchestrationPlanFormModelFromJsonText,
  orchestrationPlanFormModelToJsonText,
} from "../model/orchestrationPlanFormModels.js";
import {
  orchestrationEditorRunPanelDisplay,
  orchestrationJsonPlaceholder,
} from "../presentation/orchestrationEditorDisplayState.js";
import { orchestrationVisualEditorDisplay } from "./orchestrationStageEditorsState.js";
import type { OrchestrationPlanFormModel } from "../model/types.js";
import {
  setTxJsonEditorRawText,
  TX_EDITOR,
  txJsonEditorRawText,
} from "$domains/transactions/index.js";

interface NotifyOptions {
  notify?: boolean;
}

interface OrchestrationEditorFormState {
  formError: string;
  formModel: OrchestrationPlanFormModel;
}

interface OrchestrationEditorSyncState extends OrchestrationEditorFormState {
  jsonText: string;
}

interface OrchestrationEditorActionContext {
  didSynchronizeEditor(): boolean;
  isCurrent(): boolean;
  recordOwnedEditorSynchronization(): void;
  runOwnedEditorMutation<TResult>(operation: () => TResult): TResult;
}

interface TextFile {
  text(): Promise<string>;
}

type CreateDraftHandler = (
  actionContext: OrchestrationEditorActionContext,
) => unknown;
type EditorInputHandler = (jsonText: string) => unknown;
type ImportFileHandler = (
  file: TextFile,
  actionContext: OrchestrationEditorActionContext,
) => unknown;

interface OrchestrationEditorDependencies {
  onCreateDraft: CreateDraftHandler | null;
  onEditorInput: EditorInputHandler | null;
  onImportFile: ImportFileHandler | null;
}

interface OrchestrationEditorPanelContext {
  editorSyncVersion?: number;
  jsonPlaceholder?: string;
  onCreateDraft?: CreateDraftHandler | null;
  onEditorInput?: EditorInputHandler | null;
  onImportFile?: ImportFileHandler | null;
}

interface OrchestrationEditorWorkspaceCore {
  changeFormModel(
    nextModel: OrchestrationPlanFormModel,
    options?: NotifyOptions,
  ): void;
  handleJsonInput(jsonText?: string): OrchestrationEditorFormState;
  jsonTextStateStore: import("svelte/store").Writable<string>;
  refreshFromFormModel(
    currentModel?: OrchestrationPlanFormModel,
  ): OrchestrationEditorSyncState;
  resetToDraft(options?: NotifyOptions): {
    formModel: OrchestrationPlanFormModel;
    synchronizedByEditor: boolean;
  };
}

export function orchestrationEditorDisplays({
  formModel = orchestrationPlanFormModelFromJson(),
  jsonPlaceholder = "",
}: {
  formModel?: OrchestrationPlanFormModel;
  jsonPlaceholder?: string;
} = {}) {
  return {
    editorDisplay: orchestrationEditorRunPanelDisplay(jsonPlaceholder),
    visualDisplay: orchestrationVisualEditorDisplay(formModel),
  };
}

export function createOrchestrationSourceChangeGuard() {
  let editRevision = 0;
  let requestVersion = 0;
  let ownedMutationDepth = 0;

  return {
    begin() {
      const currentRequestVersion = requestVersion + 1;
      requestVersion = currentRequestVersion;
      const startingEditRevision = editRevision;
      return {
        isCurrent: () =>
          currentRequestVersion === requestVersion &&
          startingEditRevision === editRevision,
        runOwnedEditorMutation<TResult>(operation: () => TResult): TResult {
          ownedMutationDepth += 1;
          try {
            return operation();
          } finally {
            ownedMutationDepth -= 1;
          }
        },
      };
    },
    invalidate() {
      requestVersion += 1;
    },
    markEdited() {
      if (ownedMutationDepth === 0) editRevision += 1;
    },
  };
}

function orchestrationEditorFormStateFromJsonText(
  jsonText = "",
  currentModel: OrchestrationPlanFormModel = orchestrationPlanFormModelFromJson(),
): OrchestrationEditorFormState {
  const result = orchestrationPlanFormModelFromJsonText(jsonText);
  return {
    formError: result.error,
    formModel: result.model || currentModel,
  };
}

function orchestrationEditorFormStateFromCurrentEditor(
  currentModel: OrchestrationPlanFormModel = orchestrationPlanFormModelFromJson(),
): OrchestrationEditorFormState {
  const rawText = txJsonEditorRawText(TX_EDITOR.orchestration);
  if (!rawText) {
    return {
      formError: "",
      formModel: currentModel,
    };
  }
  return orchestrationEditorFormStateFromJsonText(rawText, currentModel);
}

function orchestrationEditorSyncState(
  currentModel: OrchestrationPlanFormModel = orchestrationPlanFormModelFromJson(),
): OrchestrationEditorSyncState {
  const baseModel = currentModel;
  const rawText = txJsonEditorRawText(TX_EDITOR.orchestration);
  if (!rawText) {
    return {
      formError: "",
      formModel: baseModel,
      jsonText: orchestrationPlanFormModelToJsonText(baseModel),
    };
  }
  const nextState = orchestrationEditorFormStateFromCurrentEditor(baseModel);
  return {
    ...nextState,
    jsonText: rawText,
  };
}

function saveOrchestrationEditorFormModel(
  formModel: OrchestrationPlanFormModel = orchestrationPlanFormModelFromJson(),
  { notify = true }: NotifyOptions = {},
): void {
  setTxJsonEditorRawText(
    TX_EDITOR.orchestration,
    orchestrationPlanFormModelToJsonText(formModel),
    { notify },
  );
}

function createOrchestrationEditorDraft({
  notify = true,
}: NotifyOptions = {}): OrchestrationPlanFormModel {
  const formModel = orchestrationPlanFormModelFromJson();
  saveOrchestrationEditorFormModel(formModel, { notify });
  return formModel;
}

function defaultOrchestrationEditorFormModel(): OrchestrationPlanFormModel {
  return orchestrationPlanFormModelFromJson();
}

function createOrchestrationEditorPanelActionWorkspace(
  editorWorkspace: OrchestrationEditorWorkspaceCore,
  dependencies: OrchestrationEditorDependencies,
) {
  let editorInputVersion = 0;
  let externalActionVersion = 0;
  let internalEditorInputDepth = 0;
  let ownedEditorActionContext: OrchestrationEditorActionContext | null = null;
  let ownedEditorInputDepth = 0;

  function beginExternalAction() {
    const requestVersion = externalActionVersion + 1;
    externalActionVersion = requestVersion;
    const startInputVersion = editorInputVersion;
    let synchronizedByOwnedNotification = false;
    const actionContext: OrchestrationEditorActionContext = {
      didSynchronizeEditor: () => synchronizedByOwnedNotification,
      isCurrent: () =>
        requestVersion === externalActionVersion &&
        startInputVersion === editorInputVersion,
      recordOwnedEditorSynchronization() {
        synchronizedByOwnedNotification = true;
      },
      runOwnedEditorMutation<TResult>(operation: () => TResult): TResult {
        const previousActionContext = ownedEditorActionContext;
        ownedEditorActionContext = actionContext;
        ownedEditorInputDepth += 1;
        try {
          return operation();
        } finally {
          ownedEditorInputDepth -= 1;
          ownedEditorActionContext = previousActionContext;
        }
      },
    };
    return actionContext;
  }

  async function createJsonDraft() {
    const actionContext = beginExternalAction();
    let resetResult;
    internalEditorInputDepth += 1;
    try {
      resetResult = editorWorkspace.resetToDraft({ notify: true });
    } finally {
      internalEditorInputDepth -= 1;
    }
    const nextModel = resetResult.formModel;
    const result = await dependencies.onCreateDraft?.(actionContext);
    if (actionContext.isCurrent()) {
      editorWorkspace.refreshFromFormModel(nextModel);
    }
    return result;
  }

  function changeFormModel(
    nextModel: OrchestrationPlanFormModel,
    options: NotifyOptions = {},
  ): void {
    editorInputVersion += 1;
    internalEditorInputDepth += 1;
    try {
      editorWorkspace.changeFormModel(nextModel, options);
    } finally {
      internalEditorInputDepth -= 1;
    }
  }

  function handleEditorJsonInput(jsonText = "") {
    dependencies.onEditorInput?.(jsonText);
    const notificationIsActionOwned =
      internalEditorInputDepth > 0 || ownedEditorInputDepth > 0;
    const notificationMatchesCanonical =
      jsonText === getStore(editorWorkspace.jsonTextStateStore);
    if (!(notificationIsActionOwned && notificationMatchesCanonical)) {
      editorWorkspace.handleJsonInput(jsonText);
    }
    if (ownedEditorInputDepth > 0 && ownedEditorActionContext) {
      ownedEditorActionContext.recordOwnedEditorSynchronization();
    } else if (internalEditorInputDepth === 0) {
      editorInputVersion += 1;
    }
  }

  async function importFile(file: TextFile): Promise<unknown> {
    const actionContext = beginExternalAction();
    const result = await dependencies.onImportFile?.(file, actionContext);
    if (actionContext.isCurrent() && !actionContext.didSynchronizeEditor()) {
      editorWorkspace.refreshFromFormModel();
    }
    return result;
  }

  return {
    changeFormModel,
    createJsonDraft,
    handleEditorJsonInput,
    importFile,
  };
}

export function createOrchestrationEditorPanelWorkspace(
  inputState: OrchestrationEditorPanelContext = {},
) {
  const dependencyState: OrchestrationEditorDependencies = {
    onCreateDraft: inputState.onCreateDraft ?? null,
    onEditorInput: inputState.onEditorInput ?? null,
    onImportFile: inputState.onImportFile ?? null,
  };
  const defaultFormModel = defaultOrchestrationEditorFormModel();
  const formModelStateStore = writable(defaultFormModel);
  const formErrorStateStore = writable("");
  const jsonTextStateStore = writable(
    orchestrationPlanFormModelToJsonText(defaultFormModel),
  );
  const editorDisplayModeStateStore = writable("form");
  const displayConfigStateStore = writable({
    jsonPlaceholder: orchestrationJsonPlaceholder,
  });
  const editorDisplayStateStore = deriveStore(
    [displayConfigStateStore, currentLanguageState],
    ([$displayConfigStateStore]) =>
      orchestrationEditorDisplays({
        formModel: defaultFormModel,
        jsonPlaceholder:
          $displayConfigStateStore?.jsonPlaceholder ||
          orchestrationJsonPlaceholder,
      }).editorDisplay,
  );
  const visualDisplayStateStore = deriveStore(
    [formModelStateStore, displayConfigStateStore, currentLanguageState],
    ([$formModelStateStore, $displayConfigStateStore]) =>
      orchestrationEditorDisplays({
        formModel: $formModelStateStore,
        jsonPlaceholder:
          $displayConfigStateStore?.jsonPlaceholder ||
          orchestrationJsonPlaceholder,
      }).visualDisplay,
  );
  let initialized = false;
  let editorInputRevision = 0;
  let lastEditorSyncVersion = 0;

  function currentFormModel() {
    return (
      getStore(formModelStateStore) || defaultOrchestrationEditorFormModel()
    );
  }

  function setEditorState(
    nextState: OrchestrationEditorFormState,
    nextJsonText = "",
  ): void {
    const nextFormModel =
      nextState.formModel || defaultOrchestrationEditorFormModel();
    formModelStateStore.set(nextFormModel);
    formErrorStateStore.set(nextState.formError || "");
    jsonTextStateStore.set(
      nextJsonText || orchestrationPlanFormModelToJsonText(nextFormModel),
    );
  }

  function refreshFromFormModel(
    currentModel: OrchestrationPlanFormModel = currentFormModel(),
  ): OrchestrationEditorSyncState {
    const nextState = orchestrationEditorSyncState(currentModel);
    const nextFormError = nextState.formError || "";
    if (nextState.jsonText === getStore(jsonTextStateStore)) {
      if (nextFormError !== getStore(formErrorStateStore)) {
        formErrorStateStore.set(nextFormError);
      }
      return nextState;
    }
    setEditorState(nextState, nextState.jsonText);
    return nextState;
  }

  function ensureInitialized() {
    if (initialized) return;
    refreshFromFormModel();
    initialized = true;
  }

  function applyEditorSyncVersion(editorSyncVersion = 0): void {
    if (editorSyncVersion === lastEditorSyncVersion) return;
    lastEditorSyncVersion = editorSyncVersion;
    refreshFromFormModel();
  }

  function publishFormModel(nextModel: OrchestrationPlanFormModel): void {
    formModelStateStore.set(nextModel);
    formErrorStateStore.set("");
    jsonTextStateStore.set(orchestrationPlanFormModelToJsonText(nextModel));
  }

  function changeFormModel(
    nextModel: OrchestrationPlanFormModel,
    { notify = true }: NotifyOptions = {},
  ): void {
    publishFormModel(nextModel);
    saveOrchestrationEditorFormModel(nextModel, { notify });
  }

  function handleJsonInput(jsonText = ""): OrchestrationEditorFormState {
    const nextState = orchestrationEditorFormStateFromJsonText(
      jsonText,
      currentFormModel(),
    );
    formModelStateStore.set(nextState.formModel);
    formErrorStateStore.set(nextState.formError || "");
    jsonTextStateStore.set(jsonText || "");
    editorInputRevision += 1;
    return nextState;
  }

  function selectEditorView(nextView = "") {
    const nextMode = nextView === "json" ? "json" : "form";
    editorDisplayModeStateStore.set(nextMode);
    if (nextMode !== "form") return;
    const nextState = orchestrationEditorFormStateFromJsonText(
      getStore(jsonTextStateStore) || "",
      currentFormModel(),
    );
    formModelStateStore.set(nextState.formModel);
    formErrorStateStore.set(nextState.formError || "");
  }

  function setFormError(nextError = ""): void {
    formErrorStateStore.set(nextError || "");
  }

  function applyDisplayConfig({
    jsonPlaceholder = orchestrationJsonPlaceholder,
  }: Pick<OrchestrationEditorPanelContext, "jsonPlaceholder"> = {}): void {
    displayConfigStateStore.set({
      jsonPlaceholder: jsonPlaceholder || orchestrationJsonPlaceholder,
    });
  }

  function resetToDraft({ notify = true }: NotifyOptions = {}) {
    const inputRevisionBeforeReset = editorInputRevision;
    const nextModel = createOrchestrationEditorDraft({ notify });
    const synchronizedByEditor =
      editorInputRevision !== inputRevisionBeforeReset;
    if (!synchronizedByEditor) {
      publishFormModel(nextModel);
    }
    return {
      formModel: nextModel,
      synchronizedByEditor,
    };
  }

  const editorWorkspace = {
    changeFormModel,
    editorDisplayStateStore,
    editorDisplayModeStateStore,
    ensureInitialized,
    formErrorStateStore,
    formModelStateStore,
    handleJsonInput,
    jsonTextStateStore,
    refreshFromFormModel,
    resetToDraft,
    selectEditorView,
    setFormError,
    visualDisplayStateStore,
  };

  return {
    ...editorWorkspace,
    ...createOrchestrationEditorPanelActionWorkspace(
      editorWorkspace,
      dependencyState,
    ),
    setEditorPanelContext(
      nextInputState: OrchestrationEditorPanelContext = {},
    ) {
      if ("jsonPlaceholder" in nextInputState) {
        applyDisplayConfig({
          jsonPlaceholder: nextInputState.jsonPlaceholder,
        });
      }
      if ("editorSyncVersion" in nextInputState) {
        applyEditorSyncVersion(nextInputState.editorSyncVersion);
      }
      if ("onCreateDraft" in nextInputState) {
        dependencyState.onCreateDraft = nextInputState.onCreateDraft ?? null;
      }
      if ("onEditorInput" in nextInputState) {
        dependencyState.onEditorInput = nextInputState.onEditorInput ?? null;
      }
      if ("onImportFile" in nextInputState) {
        dependencyState.onImportFile = nextInputState.onImportFile ?? null;
      }
    },
  };
}

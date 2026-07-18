import {
  derived as deriveStore,
  get as getStore,
  writable,
} from "svelte/store";
import { currentLanguageState, t } from "../lib/i18n.js";
import { stringValue } from "../lib/jsonValue.js";
import { orchestrationVisualEditorDisplay } from "./orchestrationStageEditorsState.js";
import {
  orchestrationPlanFormModelFromJson,
  orchestrationPlanFormModelFromJsonText,
  orchestrationPlanFormModelToJsonText,
} from "./orchestrationFormState.js";
import {
  setTxJsonEditorRawText,
  TX_EDITOR,
  txJsonEditorRawText,
} from "./transactionPanelState.js";

export * from "./orchestrationEditorSourceState.js";

const orchestrationStringValue = stringValue;

export const orchestrationJsonPlaceholder =
  '{"name":"campus-rollout","stages":[{"name":"phase-1","strategy":"parallel","jobs":[]}]}';

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
        runOwnedEditorMutation(operation) {
          ownedMutationDepth += 1;
          try {
            return typeof operation === "function" ? operation() : undefined;
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

function orchestrationEditorRunPanelDisplay(jsonPlaceholder = "") {
  const placeholderText = t("orchestrationJsonPlaceholder", jsonPlaceholder);
  return {
    editorTitle: t("orchestrationEditorTitle"),
    executeButtonLabel: t("orchestrationExecBtn"),
    importButtonLabel: t("orchestrationImportFileBtn"),
    jsonHint: t("orchestrationJsonHint"),
    newButtonLabel: t("newBtn"),
    placeholderText,
    planButtonLabel: t("orchestrationPlanBtn"),
  };
}

export function orchestrationEditorDisplays({
  formModel = {},
  jsonPlaceholder = "",
} = {}) {
  return {
    editorDisplay: orchestrationEditorRunPanelDisplay(jsonPlaceholder),
    visualDisplay: orchestrationVisualEditorDisplay(formModel),
  };
}

function orchestrationEditorFormStateFromJsonText(
  jsonText = "",
  currentModel = null,
) {
  const result = orchestrationPlanFormModelFromJsonText(jsonText);
  return {
    formError: result.error,
    formModel: result.model || currentModel,
  };
}

function orchestrationEditorFormStateFromCurrentEditor(currentModel = null) {
  const rawText = txJsonEditorRawText(TX_EDITOR.orchestration);
  if (!rawText) {
    return {
      formError: "",
      formModel: currentModel,
    };
  }
  return orchestrationEditorFormStateFromJsonText(rawText, currentModel);
}

function orchestrationEditorSyncState(currentModel = null) {
  const baseModel = currentModel || orchestrationPlanFormModelFromJson();
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
  formModel = {},
  { notify = true } = {},
) {
  setTxJsonEditorRawText(
    TX_EDITOR.orchestration,
    orchestrationPlanFormModelToJsonText(formModel),
    { notify },
  );
}

function createOrchestrationEditorDraft({ notify = true } = {}) {
  const formModel = orchestrationPlanFormModelFromJson();
  saveOrchestrationEditorFormModel(formModel, { notify });
  return formModel;
}

function defaultOrchestrationEditorFormModel() {
  return orchestrationPlanFormModelFromJson();
}

function normalizeOptionalHandler(handler) {
  return typeof handler === "function" ? handler : null;
}

function callOptionalOrchestrationDependency(
  dependencies = {},
  key = "",
  ...args
) {
  const callback = dependencies?.[key];
  return typeof callback === "function" ? callback(...args) : undefined;
}

function createOrchestrationEditorPanelActionWorkspace(
  editorWorkspace,
  dependencies = {},
) {
  let editorInputVersion = 0;
  let externalActionVersion = 0;
  let internalEditorInputDepth = 0;
  let ownedEditorActionContext = null;
  let ownedEditorInputDepth = 0;

  function beginExternalAction() {
    const requestVersion = externalActionVersion + 1;
    externalActionVersion = requestVersion;
    const startInputVersion = editorInputVersion;
    let synchronizedByOwnedNotification = false;
    const actionContext = {
      didSynchronizeEditor: () => synchronizedByOwnedNotification,
      isCurrent: () =>
        requestVersion === externalActionVersion &&
        startInputVersion === editorInputVersion,
      recordOwnedEditorSynchronization() {
        synchronizedByOwnedNotification = true;
      },
      runOwnedEditorMutation(operation) {
        const previousActionContext = ownedEditorActionContext;
        ownedEditorActionContext = actionContext;
        ownedEditorInputDepth += 1;
        try {
          return typeof operation === "function" ? operation() : undefined;
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
    const result = await callOptionalOrchestrationDependency(
      dependencies,
      "onCreateDraft",
      actionContext,
    );
    if (actionContext.isCurrent()) {
      editorWorkspace.refreshFromFormModel(nextModel);
    }
    return result;
  }

  function changeFormModel(nextModel, options = {}) {
    editorInputVersion += 1;
    internalEditorInputDepth += 1;
    try {
      editorWorkspace.changeFormModel(nextModel, options);
    } finally {
      internalEditorInputDepth -= 1;
    }
  }

  function handleEditorJsonInput(jsonText = "") {
    callOptionalOrchestrationDependency(
      dependencies,
      "onEditorInput",
      jsonText,
    );
    const notificationIsActionOwned =
      internalEditorInputDepth > 0 || ownedEditorInputDepth > 0;
    const notificationMatchesCanonical =
      (typeof jsonText === "string" ? jsonText : String(jsonText || "")) ===
      getStore(editorWorkspace.jsonTextStateStore);
    if (!(notificationIsActionOwned && notificationMatchesCanonical)) {
      editorWorkspace.handleJsonInput(jsonText);
    }
    if (ownedEditorInputDepth > 0 && ownedEditorActionContext) {
      ownedEditorActionContext.recordOwnedEditorSynchronization();
    } else if (internalEditorInputDepth === 0) {
      editorInputVersion += 1;
    }
  }

  async function importFile(file) {
    const actionContext = beginExternalAction();
    const result = await callOptionalOrchestrationDependency(
      dependencies,
      "onImportFile",
      file,
      actionContext,
    );
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

export function createOrchestrationEditorPanelWorkspace(inputState = {}) {
  const dependencyState = {
    onCreateDraft: normalizeOptionalHandler(inputState.onCreateDraft),
    onEditorInput: normalizeOptionalHandler(inputState.onEditorInput),
    onImportFile: normalizeOptionalHandler(inputState.onImportFile),
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

  function setEditorState(nextState = {}, nextJsonText = "") {
    const nextFormModel =
      nextState.formModel || defaultOrchestrationEditorFormModel();
    formModelStateStore.set(nextFormModel);
    formErrorStateStore.set(nextState.formError || "");
    jsonTextStateStore.set(
      nextJsonText || orchestrationPlanFormModelToJsonText(nextFormModel),
    );
  }

  function refreshFromFormModel(currentModel = currentFormModel()) {
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

  function applyEditorSyncVersion(editorSyncVersion = 0) {
    if (editorSyncVersion === lastEditorSyncVersion) return;
    lastEditorSyncVersion = editorSyncVersion;
    refreshFromFormModel();
  }

  function publishFormModel(nextModel) {
    formModelStateStore.set(nextModel);
    formErrorStateStore.set("");
    jsonTextStateStore.set(orchestrationPlanFormModelToJsonText(nextModel));
  }

  function changeFormModel(nextModel, { notify = true } = {}) {
    publishFormModel(nextModel);
    saveOrchestrationEditorFormModel(nextModel, { notify });
  }

  function handleJsonInput(jsonText = "") {
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

  function setFormError(nextError = "") {
    formErrorStateStore.set(nextError || "");
  }

  function applyDisplayConfig({
    jsonPlaceholder = orchestrationJsonPlaceholder,
  } = {}) {
    displayConfigStateStore.set({
      jsonPlaceholder:
        typeof jsonPlaceholder === "string" && jsonPlaceholder
          ? jsonPlaceholder
          : orchestrationJsonPlaceholder,
    });
  }

  function resetToDraft({ notify = true } = {}) {
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
    setEditorPanelContext(nextInputState = {}) {
      if ("jsonPlaceholder" in nextInputState) {
        applyDisplayConfig({
          jsonPlaceholder: nextInputState.jsonPlaceholder,
        });
      }
      if ("editorSyncVersion" in nextInputState) {
        applyEditorSyncVersion(nextInputState.editorSyncVersion);
      }
      if ("onCreateDraft" in nextInputState) {
        dependencyState.onCreateDraft = normalizeOptionalHandler(
          nextInputState.onCreateDraft,
        );
      }
      if ("onEditorInput" in nextInputState) {
        dependencyState.onEditorInput = normalizeOptionalHandler(
          nextInputState.onEditorInput,
        );
      }
      if ("onImportFile" in nextInputState) {
        dependencyState.onImportFile = normalizeOptionalHandler(
          nextInputState.onImportFile,
        );
      }
    },
  };
}

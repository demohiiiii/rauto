import { derived as deriveStore, writable } from "svelte/store";

import { currentLanguageState } from "../lib/i18n.js";
import { safeString as safeTemplateString } from "../lib/ui.js";
import {
  defaultTxBlockTemplatePayload,
  txBlockEditorFormStateFromJsonText,
  txBlockFormModelFromJson,
  txBlockFormModelToJsonText,
} from "./transactionBlockFormModels.js";
import {
  defaultTxWorkflowTemplatePayload,
  txWorkflowEditorFormStateFromJsonText,
  txWorkflowFormModelFromJson,
  txWorkflowFormModelToJsonText,
} from "./transactionWorkflowFormModels.js";
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
  setTxVarsRawText,
  txVarsTextStateFor,
} from "./transactionPanelState.js";

export * from "./transactionInputState.js";

export function createTxTemplateRunPanelWorkspace(inputState = {}) {
  const dependencyState = {
    getTemplateKind:
      typeof inputState.getTemplateKind === "function"
        ? inputState.getTemplateKind
        : null,
    getVarsKey:
      typeof inputState.getVarsKey === "function"
        ? inputState.getVarsKey
        : null,
    onCreateTemplateDraft: normalizeOptionalHandler(
      inputState.onCreateTemplateDraft,
    ),
    onDeleteTemplate: normalizeOptionalHandler(inputState.onDeleteTemplate),
    onLoadTemplate: normalizeOptionalHandler(inputState.onLoadTemplate),
    onSaveTemplate: normalizeOptionalHandler(inputState.onSaveTemplate),
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
  const editorDisplayModeStateStore = writable("form");
  const panelDisplayConfigStateStore = writable({
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

  function changeVarsText(varsText = "") {
    const varsKey =
      typeof dependencyState.getVarsKey === "function"
        ? dependencyState.getVarsKey()
        : "";
    setTxVarsRawText(varsKey, varsText, { source: "editor" });
  }

  async function loadTemplate(selectedTemplate) {
    const templateKind =
      typeof dependencyState.getTemplateKind === "function"
        ? dependencyState.getTemplateKind()
        : "";
    const nextTemplate = jsonTemplateNameValue(selectedTemplate);
    setJsonTemplateSelectValue(templateKind, nextTemplate);
    if (!nextTemplate || typeof dependencyState.onLoadTemplate !== "function") {
      return;
    }
    return loadingRunner.run("template-load", () =>
      dependencyState.onLoadTemplate(nextTemplate),
    );
  }

  function createTemplateDraft() {
    return loadingRunner.run(
      "template-new",
      dependencyState.onCreateTemplateDraft,
    );
  }

  function saveTemplate() {
    return loadingRunner.run("template-save", dependencyState.onSaveTemplate);
  }

  function deleteTemplate() {
    return loadingRunner.run(
      "template-delete",
      dependencyState.onDeleteTemplate,
    );
  }

  function selectEditorView(nextView = "") {
    editorDisplayModeStateStore.set(nextView === "json" ? "json" : "form");
  }

  function applyPanelConfig(nextConfig = {}) {
    panelDisplayConfigStateStore.set({
      ariaLabel: safeTemplateString(nextConfig.ariaLabel),
      hintKeys: Array.isArray(nextConfig.hintKeys) ? nextConfig.hintKeys : [],
      varsPlaceholderFallback: safeTemplateString(
        nextConfig.varsPlaceholderFallback,
      ),
      varsPlaceholderKey: safeTemplateString(nextConfig.varsPlaceholderKey),
    });
  }

  function applyDependencyInputs(nextInputState = {}) {
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
      dependencyState.onCreateTemplateDraft = normalizeOptionalHandler(
        nextInputState.onCreateTemplateDraft,
      );
    }
    if ("onDeleteTemplate" in nextInputState) {
      dependencyState.onDeleteTemplate = normalizeOptionalHandler(
        nextInputState.onDeleteTemplate,
      );
    }
    if ("onLoadTemplate" in nextInputState) {
      dependencyState.onLoadTemplate = normalizeOptionalHandler(
        nextInputState.onLoadTemplate,
      );
    }
    if ("onSaveTemplate" in nextInputState) {
      dependencyState.onSaveTemplate = normalizeOptionalHandler(
        nextInputState.onSaveTemplate,
      );
    }
  }

  function setTemplateRunPanelContext(nextContext = {}) {
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

export function createTxBlockInputPanelWorkspace(inputState = {}) {
  const dependencyState = {
    onCreateDirectDraft: normalizeOptionalHandler(
      inputState.onCreateDirectDraft,
    ),
    onCreateJsonTemplateDraft: normalizeOptionalHandler(
      inputState.onCreateJsonTemplateDraft,
    ),
    onEditorInput: normalizeOptionalHandler(inputState.onEditorInput),
    onImportFile: normalizeOptionalHandler(inputState.onImportFile),
    onLoadJsonTemplate: normalizeOptionalHandler(inputState.onLoadJsonTemplate),
  };
  const txInputWorkspace = createTxInputPanelWorkspace({
    buildDefaultFormModel: () =>
      txBlockFormModelFromJson(defaultTxBlockTemplatePayload()),
    formModelToJsonText: txBlockFormModelToJsonText,
    inputEditorSyncState: txBlockInputEditorSyncState,
    inputFormStateFromJsonText: txBlockEditorFormStateFromJsonText,
    saveEditorFormModel: saveTxBlockEditorFormModel,
  });
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
  const editorDisplayStateStore = deriveStore(
    panelDisplayStateStore,
    ($panelDisplayStateStore) =>
      txBlockInputEditorSurfaceDisplay($panelDisplayStateStore),
  );
  const actionWorkspace = createTxInputPanelActionWorkspace(
    txInputWorkspace,
    dependencyState,
  );

  function setBlockInputPanelContext(nextInputState = {}) {
    if ("newButtonLabelKey" in nextInputState) {
      panelConfigStateStore.update((currentConfig) => ({
        ...currentConfig,
        newButtonLabelKey: safeTemplateString(nextInputState.newButtonLabelKey),
      }));
    }
    if ("onCreateDirectDraft" in nextInputState) {
      dependencyState.onCreateDirectDraft = normalizeOptionalHandler(
        nextInputState.onCreateDirectDraft,
      );
    }
    if ("onCreateJsonTemplateDraft" in nextInputState) {
      dependencyState.onCreateJsonTemplateDraft = normalizeOptionalHandler(
        nextInputState.onCreateJsonTemplateDraft,
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
    if ("onLoadJsonTemplate" in nextInputState) {
      dependencyState.onLoadJsonTemplate = normalizeOptionalHandler(
        nextInputState.onLoadJsonTemplate,
      );
    }
  }

  return {
    editorDisplayStateStore,
    panelDisplayStateStore,
    setBlockInputPanelContext,
    ...txInputWorkspace,
    ...actionWorkspace,
  };
}

export function createTxWorkflowInputPanelWorkspace(inputState = {}) {
  const dependencyState = {
    onCreateDirectDraft: normalizeOptionalHandler(
      inputState.onCreateDirectDraft,
    ),
    onCreateJsonTemplateDraft: normalizeOptionalHandler(
      inputState.onCreateJsonTemplateDraft,
    ),
    onEditorInput: normalizeOptionalHandler(inputState.onEditorInput),
    onImportFile: normalizeOptionalHandler(inputState.onImportFile),
    onLoadJsonTemplate: normalizeOptionalHandler(inputState.onLoadJsonTemplate),
  };
  const txInputWorkspace = createTxInputPanelWorkspace({
    buildDefaultFormModel: () =>
      txWorkflowFormModelFromJson(defaultTxWorkflowTemplatePayload()),
    formModelToJsonText: txWorkflowFormModelToJsonText,
    inputEditorSyncState: txWorkflowInputEditorSyncState,
    inputFormStateFromJsonText: txWorkflowEditorFormStateFromJsonText,
    saveEditorFormModel: saveTxWorkflowEditorFormModel,
  });
  const panelDisplayStateStore = deriveStore(currentLanguageState, () =>
    txWorkflowInputPanelDisplay({
      jsonPlaceholder: txWorkflowJsonPlaceholder,
    }),
  );
  const editorDisplayStateStore = deriveStore(
    panelDisplayStateStore,
    ($panelDisplayStateStore) =>
      txWorkflowInputEditorSurfaceDisplay($panelDisplayStateStore),
  );
  const actionWorkspace = createTxInputPanelActionWorkspace(
    txInputWorkspace,
    dependencyState,
  );

  function setWorkflowInputPanelContext(nextInputState = {}) {
    if ("onCreateDirectDraft" in nextInputState) {
      dependencyState.onCreateDirectDraft = normalizeOptionalHandler(
        nextInputState.onCreateDirectDraft,
      );
    }
    if ("onCreateJsonTemplateDraft" in nextInputState) {
      dependencyState.onCreateJsonTemplateDraft = normalizeOptionalHandler(
        nextInputState.onCreateJsonTemplateDraft,
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
    if ("onLoadJsonTemplate" in nextInputState) {
      dependencyState.onLoadJsonTemplate = normalizeOptionalHandler(
        nextInputState.onLoadJsonTemplate,
      );
    }
  }

  return {
    editorDisplayStateStore,
    panelDisplayStateStore,
    setWorkflowInputPanelContext,
    ...txInputWorkspace,
    ...actionWorkspace,
    handleWorkflowEditorInput: actionWorkspace.handleEditorJsonInput,
  };
}

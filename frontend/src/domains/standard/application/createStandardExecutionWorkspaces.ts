import { derived, get, writable } from "svelte/store";
import type { InteractiveTemplateModel } from "$domains/command/index.js";
import {
  createInteractiveTemplate,
  getInteractiveTemplate,
  inspectInteractiveTemplate,
  updateInteractiveTemplate,
} from "../../../api/client.js";
import { browserConfirm } from "../../../lib/browser.js";
import { callbackFormValueHandler } from "../../../lib/events.js";
import { currentLanguageState } from "../../../lib/i18n.js";
import { createLoadingRunner } from "../../../lib/svelte.js";
import {
  executionResultDisplay,
  exportParsedOutputSheetsExcel,
} from "$domains/execution/index.js";
import {
  createSessionRetryState,
  sessionRetryValidation,
} from "$domains/execution/index.js";
import type { SessionRetryState } from "$domains/execution/index.js";
import { MODE_SELECT, modeSelection } from "$domains/profiles/index.js";
import { interactiveVarsPresentation } from "$domains/templates/index.js";
import { createInteractiveTemplateRuntime } from "$domains/templates/index.js";
import type { BatchDeliveryWorkspace } from "./createBatchDeliveryWorkspace.js";
import { standardInteractiveRuntime } from "../infrastructure/standardInteractiveRuntime.js";
import { standardInteractiveTextfsmPayload } from "../model/standardInteractive.js";
import {
  interactiveResultPresentation,
  interactiveExecutionInputPresentation,
  standardInteractiveRunButtonPresentation,
  standardInteractiveTemplateFieldsPresentation,
  standardInteractiveTemplateSelectPresentation,
  standardModeSelectPresentation,
  standardTextfsmFieldsPresentation,
} from "../presentation/standardInteractivePresentation.js";
import { createStandardInteractiveAuthoringState } from "./createStandardInteractiveAuthoringState.js";
import type { StandardInteractiveTextfsmFields } from "../model/types.js";
import { createStandardInteractiveExecution } from "./standardInteractiveExecutionState.js";

function createInteractiveVarsInputPanelWorkspace({
  onValueChange = null,
}: {
  onValueChange?: ((name: string, value: string) => void) | null;
} = {}) {
  return {
    changeInteractiveVarValue(interactiveVarName: string) {
      return callbackFormValueHandler(onValueChange, interactiveVarName);
    },
  };
}

export function createInteractiveExecutionPanelWorkspace(
  batch?: BatchDeliveryWorkspace,
) {
  const {
    interactiveVarsFieldState,
    getCurrentInteractiveTemplateFieldDraft,
    loadInteractiveTemplates,
    parseBuiltinInteractiveTemplateValue,
    runInteractiveTemplateSelectState,
    setInteractiveVarDraftValue,
    updateInteractiveTemplateVarFields,
    buildInteractiveVarsPayload,
  } = createInteractiveTemplateRuntime();
  const execution = createStandardInteractiveExecution({
    runtime: {
      ...standardInteractiveRuntime,
      buildVarsPayload: buildInteractiveVarsPayload,
    },
  });
  const {
    interactiveExecutionResultState,
    createStandardLoadingKeysStore,
    createStandardTextfsmStateStore,
    executeInteractive,
    exportInteractiveExcel,
    downloadInteractiveOutput,
    setStandardTextfsmEnabled,
    setStandardTextfsmFields,
    setStandardTextfsmStrictErrors,
    setStandardTextfsmTemplate,
  } = execution;
  const interactiveExecutionResultStateStore =
    interactiveExecutionResultState();
  const authoringModePicker = modeSelection(MODE_SELECT.standardInteractive);
  const interactiveTextfsmStateStore = createStandardTextfsmStateStore();
  const interactiveRetryStateStore = writable<SessionRetryState>(
    createSessionRetryState(),
  );
  const { loadingKeysStore, loadingRunner } =
    createStandardLoadingKeysStore(createLoadingRunner);
  const interactiveVarsInputPanelWorkspace =
    createInteractiveVarsInputPanelWorkspace({
      onValueChange: setInteractiveVarDraftValue,
    });
  const authoring = createStandardInteractiveAuthoringState({
    confirmDiscard: browserConfirm,
    createTemplate: createInteractiveTemplate,
    getTemplate: getInteractiveTemplate,
    inspectTemplate: inspectInteractiveTemplate,
    onInspection(detail) {
      updateInteractiveTemplateVarFields(
        detail,
        getCurrentInteractiveTemplateFieldDraft(),
      );
    },
    parseBuiltinSelection: parseBuiltinInteractiveTemplateValue,
    refreshTemplates: async () => {
      await loadInteractiveTemplates();
    },
    updateTemplate: updateInteractiveTemplate,
  });
  const interactivePanelDisplayStateStore = derived(
    [
      runInteractiveTemplateSelectState,
      interactiveVarsFieldState,
      authoringModePicker.state,
      interactiveTextfsmStateStore,
      interactiveRetryStateStore,
      interactiveExecutionResultStateStore,
      loadingKeysStore,
      authoring.selectionStateStore,
      authoring.actionStateStore,
      authoring.nameDialogStateStore,
      authoring.draft.modelStateStore,
      authoring.draft.tomlTextStateStore,
      authoring.draft.errorStateStore,
      authoring.draft.activeTabStateStore,
      authoring.draft.inspectionStateStore,
      currentLanguageState,
    ] as const,
    ([
      $runInteractiveTemplateSelectState,
      $interactiveVarsFieldState,
      $authoringModeState,
      $interactiveTextfsmState,
      $interactiveRetryState,
      $interactiveExecutionResult,
      $loadingKeysStore,
      $authoringSelection,
      $authoringActions,
      $nameDialog,
      $authoringModel,
      $authoringTomlText,
      $authoringError,
      $authoringActiveTab,
      $authoringInspection,
      $currentLanguageState,
    ]) => {
      const interactiveTemplateSelectDisplay =
        standardInteractiveTemplateSelectPresentation(
          $runInteractiveTemplateSelectState,
        );
      const interactiveTemplateFields =
        standardInteractiveTemplateFieldsPresentation({
          templateName: $authoringSelection.value,
          templateOptions: interactiveTemplateSelectDisplay.templateOptions,
        });
      const interactiveTextfsmFields = standardTextfsmFieldsPresentation({
        enabled: $interactiveTextfsmState.enabled,
        autoDownloadExcel: $interactiveTextfsmState.autoDownloadExcel,
        autoDownloadOutput: $interactiveTextfsmState.autoDownloadOutput,
        strictErrors: $interactiveTextfsmState.strictErrors,
        template: $interactiveTextfsmState.template,
      });
      const executionStatusDisplay = executionResultDisplay(
        $interactiveExecutionResult,
      );
      const authoringModeDisplay =
        standardModeSelectPresentation($authoringModeState);
      return {
        authoringDisplay: {
          ...$authoringActions,
          activeTab: $authoringActiveTab,
          errorMessage:
            $authoringError || $authoringInspection.errorMessage || "",
          inspecting: !!$authoringInspection.loading,
          modeOptions: authoringModeDisplay.modeOptions,
          model: $authoringModel,
          nameDialog: $nameDialog,
          selection: $authoringSelection,
          tomlText: $authoringTomlText,
        },
        executionStatusDisplay,
        exportLoading: $loadingKeysStore.includes("export"),
        interactiveInputDisplay: interactiveExecutionInputPresentation({
          templateName: interactiveTemplateFields.templateName,
          templateOptions: interactiveTemplateFields.templateOptions,
        }),
        interactiveResultDisplay: interactiveResultPresentation(
          $interactiveExecutionResult.kind === "result"
            ? $interactiveExecutionResult.resultPayload
            : null,
        ),
        interactiveRunButtonDisplay: standardInteractiveRunButtonPresentation({
          executeLoading: $loadingKeysStore.includes("execute"),
        }),
        interactiveRetryState: $interactiveRetryState,
        interactiveRetryValid: sessionRetryValidation($interactiveRetryState)
          .valid,
        interactiveTemplateFields,
        interactiveTextfsmFields,
        interactiveVarsDisplay: interactiveVarsPresentation(
          $interactiveVarsFieldState,
        ),
        language: $currentLanguageState,
      };
    },
  );
  let panelActive = false;
  let lastInteractiveLanguage = "";

  function syncAuthoringSelection(): void {
    const selected = get(authoring.selectionStateStore).value;
    runInteractiveTemplateSelectState.update((state) => ({
      ...state,
      selected,
    }));
  }

  async function changeInteractiveTemplateName(
    interactiveTemplateName = "",
  ): Promise<boolean> {
    const changed = await authoring.selectTemplate(interactiveTemplateName);
    if (changed) syncAuthoringSelection();
    return changed;
  }

  function changeInteractiveEditorTab(
    editorTab: Parameters<typeof authoring.draft.selectTab>[0] = "visual",
  ): void {
    authoring.draft.selectTab(editorTab);
  }

  function changeInteractiveModel(model: InteractiveTemplateModel): void {
    authoring.setModel(model);
  }

  function changeInteractiveToml(tomlText = ""): boolean {
    return authoring.setTomlText(tomlText);
  }

  function changeInteractiveAutoDownloadExcel(
    autoDownloadExcel: boolean,
  ): void {
    interactiveTextfsmStateStore.update((state) => ({
      ...state,
      autoDownloadExcel,
    }));
  }

  function changeInteractiveAutoDownloadOutput(
    autoDownloadOutput: boolean,
  ): void {
    interactiveTextfsmStateStore.update((state) => ({
      ...state,
      autoDownloadOutput,
    }));
  }

  function changeInteractiveTextfsmEnabled(textfsmEnabled = false): void {
    setStandardTextfsmEnabled(interactiveTextfsmStateStore, textfsmEnabled);
  }

  function changeInteractiveTextfsmStrictErrors(
    textfsmStrictErrors = false,
  ): void {
    setStandardTextfsmStrictErrors(
      interactiveTextfsmStateStore,
      textfsmStrictErrors,
    );
  }

  function changeInteractiveTextfsmTemplate(textfsmTemplate = ""): void {
    setStandardTextfsmTemplate(interactiveTextfsmStateStore, textfsmTemplate);
  }

  function changeInteractiveRetry(
    retry: Partial<SessionRetryState> = {},
  ): void {
    interactiveRetryStateStore.set({
      ...createSessionRetryState(),
      ...retry,
    });
  }

  function executeInteractiveExecution() {
    return loadingRunner.run("execute", async () => {
      const settings = get(interactiveTextfsmStateStore);
      const retry = get(interactiveRetryStateStore);
      if (batch) {
        await batch.executeInteractive(
          () =>
            execution.interactiveExecutionPayload({
              source: authoring.executeSource(),
              retry,
              vars: buildInteractiveVarsPayload(),
              recordLevel: standardInteractiveRuntime.recordLevelPayload(),
              textfsm: standardInteractiveTextfsmPayload(settings),
            }),
          settings,
        );
        return;
      }
      setStandardTextfsmFields(settings);
      return executeInteractive(authoring.executeSource(), retry);
    });
  }

  async function saveInteractiveTemplate(): Promise<boolean> {
    const saved = await authoring.save();
    if (saved) syncAuthoringSelection();
    return saved;
  }

  function openNewInteractiveDialog(): void {
    authoring.openNewDialog();
  }

  function openSaveAsInteractiveDialog(): void {
    authoring.openSaveAsDialog();
  }

  function closeInteractiveNameDialog(): void {
    authoring.closeNameDialog();
  }

  function changeInteractiveNameDialogValue(value = ""): void {
    authoring.setNameDialogValue(value);
  }

  async function submitInteractiveNameDialog(): Promise<boolean> {
    const saved = await authoring.submitNameDialog();
    if (saved) syncAuthoringSelection();
    return saved;
  }

  function exportInteractiveExecutionExcel() {
    return loadingRunner.run("export", () =>
      exportInteractiveExcel(exportParsedOutputSheetsExcel),
    );
  }

  const runActionHandlers = {
    execute: executeInteractiveExecution,
    export: () => exportInteractiveExecutionExcel(),
    downloadOutput: downloadInteractiveOutput,
  };

  function setPanelContext({
    active = false,
    interactivePanelDisplay = null,
  }: {
    active?: boolean;
    interactivePanelDisplay?: {
      interactiveTextfsmFields: StandardInteractiveTextfsmFields;
      language: string;
    } | null;
  } = {}): void {
    if (!active) {
      panelActive = false;
      return;
    }
    if (!interactivePanelDisplay) return;
    if (!panelActive) {
      panelActive = true;
      void loadInteractiveTemplates();
    }
    const language = interactivePanelDisplay.language;
    if (lastInteractiveLanguage !== language) {
      lastInteractiveLanguage = language;
      updateInteractiveTemplateVarFields(
        {
          vars_schema: get(authoring.draft.inspectionStateStore).varsSchema,
        },
        getCurrentInteractiveTemplateFieldDraft(),
      );
    }
    setStandardTextfsmFields(interactivePanelDisplay.interactiveTextfsmFields);
  }

  return {
    authoring,
    changeInteractiveEditorTab,
    changeInteractiveModel,
    changeInteractiveNameDialogValue,
    changeInteractiveTemplateName,
    changeInteractiveTextfsmEnabled,
    changeInteractiveAutoDownloadExcel,
    changeInteractiveAutoDownloadOutput,
    changeInteractiveTextfsmStrictErrors,
    changeInteractiveTextfsmTemplate,
    changeInteractiveRetry,
    changeInteractiveToml,
    changeInteractiveVarValue:
      interactiveVarsInputPanelWorkspace.changeInteractiveVarValue,
    closeInteractiveNameDialog,
    executeInteractiveExecution,
    exportInteractiveExecutionExcel,
    interactivePanelDisplayStateStore,
    openNewInteractiveDialog,
    openSaveAsInteractiveDialog,
    runActionHandlers,
    saveInteractiveTemplate,
    saveInteractiveTemplateAs: authoring.saveAs,
    setPanelContext,
    submitInteractiveNameDialog,
  };
}

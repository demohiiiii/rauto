import { derived, get, writable } from "svelte/store";
import type { CommandFlowTemplateModel } from "$domains/command/index.js";
import type { StandardExecMode } from "../../../config/dashboardModes.js";
import {
  createCommandFlowTemplate,
  getCommandFlowTemplate,
  inspectCommandFlowTemplate,
  updateCommandFlowTemplate,
} from "../../../api/client.js";
import { normalizeStandardExecMode } from "../../../config/dashboardModes.js";
import { browserConfirm } from "../../../lib/browser.js";
import { callbackFormValueHandler } from "../../../lib/events.js";
import { currentLanguageState } from "../../../lib/i18n.js";
import { createLoadingRunner } from "../../../lib/svelte.js";
import { safeString } from "../../../lib/ui.js";
import {
  executionResultDisplay,
  exportParsedOutputSheetsExcel,
} from "$domains/execution/index.js";
import {
  createSessionRetryState,
  sessionRetryValidation,
} from "$domains/execution/index.js";
import type { SessionRetryState } from "$domains/execution/index.js";
import {
  MODE_SELECT,
  TEXTFSM_PLATFORM_SELECT,
  modeSelection,
  textfsmPlatformSelection,
} from "$domains/profiles/index.js";
import { flowVarsPresentation } from "$domains/templates/index.js";
import {
  flowVarsFieldState,
  getCurrentFlowTemplateFieldDraft,
  loadFlowTemplates,
  parseBuiltinFlowTemplateValue,
  runFlowTemplateSelectState,
  setFlowVarDraftValue,
  updateFlowTemplateVarFields,
} from "$domains/templates/index.js";
import {
  commandFlowResultPresentation,
  flowExecutionInputPresentation,
  standardFlowRunButtonPresentation,
  standardFlowTemplateFieldsPresentation,
  standardFlowTemplateSelectPresentation,
  standardModeSelectPresentation,
  standardPagePresentation,
  standardTextfsmFieldsPresentation,
} from "../presentation/standardFlowPresentation.js";
import { createStandardCommandFlowAuthoringState } from "./createStandardCommandFlowAuthoringState.js";
import type { StandardCommandFlowTextfsmFields } from "../model/types.js";
import {
  commandFlowExecutionResultState,
  createStandardLoadingKeysStore,
  createStandardTextfsmStateStore,
  DEFAULT_STANDARD_PAGE_MODE,
  executeCommandFlow,
  exportCommandFlowExcel,
  refreshStandardExecutionModeOptions,
  setStandardTextfsmEnabled,
  setStandardTextfsmFields,
  setStandardTextfsmStrictErrors,
  setStandardTextfsmTemplate,
} from "./standardCommandFlowExecutionState.js";

export function createStandardPageWorkspace() {
  const currentExecModeState = writable(DEFAULT_STANDARD_PAGE_MODE);
  const pageDisplayStateStore = derived(
    [currentExecModeState, currentLanguageState],
    ([$currentExecModeState]) =>
      standardPagePresentation($currentExecModeState),
  );
  let lastExecutionProfile = "";

  function selectExecMode(standardExecMode: string): void {
    currentExecModeState.set(normalizeStandardExecMode(standardExecMode));
  }

  function setRouteContext({
    active = false,
    profile = "",
  }: { active?: boolean; profile?: string } = {}): void {
    const executionProfile = profile.trim();
    if (!active) {
      lastExecutionProfile = "";
      return;
    }
    if (lastExecutionProfile === executionProfile) return;
    lastExecutionProfile = executionProfile;
    void refreshStandardExecutionModeOptions();
  }

  function destroy(): void {
    lastExecutionProfile = "";
  }

  return {
    currentExecModeState,
    destroy,
    pageDisplayStateStore,
    selectExecMode,
    setRouteContext,
  };
}

function createFlowVarsInputPanelWorkspace({
  onValueChange = null,
}: {
  onValueChange?: ((name: string, value: string) => void) | null;
} = {}) {
  return {
    changeFlowVarValue(flowVarName: string) {
      return callbackFormValueHandler(onValueChange, flowVarName);
    },
  };
}

export function createFlowExecutionPanelWorkspace() {
  const commandFlowExecutionResultStateStore =
    commandFlowExecutionResultState();
  const authoringModePicker = modeSelection(MODE_SELECT.standardFlow);
  const textfsmPlatformPicker = textfsmPlatformSelection(
    TEXTFSM_PLATFORM_SELECT.standard,
  );
  const flowTextfsmStateStore = createStandardTextfsmStateStore();
  const flowRetryStateStore = writable<SessionRetryState>(
    createSessionRetryState(),
  );
  const { loadingKeysStore, loadingRunner } =
    createStandardLoadingKeysStore(createLoadingRunner);
  const flowVarsInputPanelWorkspace = createFlowVarsInputPanelWorkspace({
    onValueChange: setFlowVarDraftValue,
  });
  const authoring = createStandardCommandFlowAuthoringState({
    confirmDiscard: browserConfirm,
    createTemplate: createCommandFlowTemplate,
    getTemplate: getCommandFlowTemplate,
    inspectTemplate: inspectCommandFlowTemplate,
    onInspection(detail) {
      updateFlowTemplateVarFields(detail, getCurrentFlowTemplateFieldDraft());
    },
    parseBuiltinSelection: parseBuiltinFlowTemplateValue,
    refreshTemplates: async () => {
      await loadFlowTemplates();
    },
    updateTemplate: updateCommandFlowTemplate,
  });
  const flowPanelDisplayStateStore = derived(
    [
      runFlowTemplateSelectState,
      flowVarsFieldState,
      authoringModePicker.state,
      textfsmPlatformPicker.state,
      flowTextfsmStateStore,
      flowRetryStateStore,
      commandFlowExecutionResultStateStore,
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
      $runFlowTemplateSelectState,
      $flowVarsFieldState,
      $authoringModeState,
      $textfsmPlatformState,
      $flowTextfsmState,
      $flowRetryState,
      $commandFlowExecutionResult,
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
      const flowTemplateSelectDisplay = standardFlowTemplateSelectPresentation(
        $runFlowTemplateSelectState,
      );
      const flowTemplateFields = standardFlowTemplateFieldsPresentation({
        templateName: $authoringSelection.value,
        templateOptions: flowTemplateSelectDisplay.templateOptions,
      });
      const flowTextfsmFields = standardTextfsmFieldsPresentation({
        enabled: $flowTextfsmState.enabled,
        platformState: $textfsmPlatformState,
        strictErrors: $flowTextfsmState.strictErrors,
        template: $flowTextfsmState.template,
      });
      const executionStatusDisplay = executionResultDisplay(
        $commandFlowExecutionResult,
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
        flowInputDisplay: flowExecutionInputPresentation({
          templateName: flowTemplateFields.templateName,
          templateOptions: flowTemplateFields.templateOptions,
        }),
        flowResultDisplay: commandFlowResultPresentation(
          $commandFlowExecutionResult.kind === "result"
            ? $commandFlowExecutionResult.resultPayload
            : null,
        ),
        flowRunButtonDisplay: standardFlowRunButtonPresentation({
          executeLoading: $loadingKeysStore.includes("execute"),
        }),
        flowRetryState: $flowRetryState,
        flowRetryValid: sessionRetryValidation($flowRetryState).valid,
        flowTemplateFields,
        flowTextfsmFields,
        flowVarsDisplay: flowVarsPresentation($flowVarsFieldState),
        language: $currentLanguageState,
      };
    },
  );
  let commandFlowPrepared = false;
  let lastCommandFlowLanguage = "";

  function syncAuthoringSelection(): void {
    const selected = get(authoring.selectionStateStore).value;
    runFlowTemplateSelectState.update((state) => ({ ...state, selected }));
  }

  async function changeFlowTemplateName(
    flowTemplateName = "",
  ): Promise<boolean> {
    const changed = await authoring.selectTemplate(flowTemplateName);
    if (changed) syncAuthoringSelection();
    return changed;
  }

  function changeFlowEditorTab(
    editorTab: Parameters<typeof authoring.draft.selectTab>[0] = "visual",
  ): void {
    authoring.draft.selectTab(editorTab);
  }

  function changeFlowModel(model: CommandFlowTemplateModel): void {
    authoring.setModel(model);
  }

  function changeFlowToml(tomlText = ""): boolean {
    return authoring.setTomlText(tomlText);
  }

  function changeFlowTextfsmEnabled(textfsmEnabled = false): void {
    setStandardTextfsmEnabled(flowTextfsmStateStore, textfsmEnabled);
  }

  function changeFlowTextfsmPlatform(textfsmPlatform = ""): void {
    textfsmPlatformPicker.setValue(textfsmPlatform);
  }

  function changeFlowTextfsmStrictErrors(textfsmStrictErrors = false): void {
    setStandardTextfsmStrictErrors(flowTextfsmStateStore, textfsmStrictErrors);
  }

  function changeFlowTextfsmTemplate(textfsmTemplate = ""): void {
    setStandardTextfsmTemplate(flowTextfsmStateStore, textfsmTemplate);
  }

  function changeFlowRetry(retry: Partial<SessionRetryState> = {}): void {
    flowRetryStateStore.set({
      ...createSessionRetryState(),
      ...retry,
    });
  }

  function executeFlowExecution() {
    return loadingRunner.run("execute", () =>
      executeCommandFlow(authoring.executeSource(), get(flowRetryStateStore)),
    );
  }

  async function saveFlowTemplate(): Promise<boolean> {
    const saved = await authoring.save();
    if (saved) syncAuthoringSelection();
    return saved;
  }

  function openNewFlowDialog(): void {
    authoring.openNewDialog();
  }

  function openSaveAsFlowDialog(): void {
    authoring.openSaveAsDialog();
  }

  function closeFlowNameDialog(): void {
    authoring.closeNameDialog();
  }

  function changeFlowNameDialogValue(value = ""): void {
    authoring.setNameDialogValue(value);
  }

  async function submitFlowNameDialog(): Promise<boolean> {
    const saved = await authoring.submitNameDialog();
    if (saved) syncAuthoringSelection();
    return saved;
  }

  function exportFlowExecutionExcel() {
    return loadingRunner.run("export", () =>
      exportCommandFlowExcel(exportParsedOutputSheetsExcel),
    );
  }

  const runActionHandlers = {
    execute: executeFlowExecution,
    export: () => exportFlowExecutionExcel(),
  };

  async function prepareAuthoringOnActive(): Promise<void> {
    await loadFlowTemplates();
    const selected = safeString(
      get(runFlowTemplateSelectState).selected,
    ).trim();
    if (selected) await changeFlowTemplateName(selected);
  }

  function setPanelContext({
    active = false,
    flowPanelDisplay = null,
  }: {
    active?: boolean;
    flowPanelDisplay?: {
      flowTextfsmFields: StandardCommandFlowTextfsmFields;
      language: string;
    } | null;
  } = {}): void {
    if (!active) {
      commandFlowPrepared = false;
      lastCommandFlowLanguage = "";
      return;
    }
    if (!flowPanelDisplay) return;
    if (!commandFlowPrepared) {
      commandFlowPrepared = true;
      void prepareAuthoringOnActive();
    }
    const language = flowPanelDisplay.language;
    if (lastCommandFlowLanguage !== language) {
      lastCommandFlowLanguage = language;
      updateFlowTemplateVarFields(
        {
          vars_schema: get(authoring.draft.inspectionStateStore).varsSchema,
        },
        getCurrentFlowTemplateFieldDraft(),
      );
    }
    setStandardTextfsmFields(flowPanelDisplay.flowTextfsmFields);
  }

  return {
    authoring,
    changeFlowEditorTab,
    changeFlowModel,
    changeFlowNameDialogValue,
    changeFlowTemplateName,
    changeFlowTextfsmEnabled,
    changeFlowTextfsmPlatform,
    changeFlowTextfsmStrictErrors,
    changeFlowTextfsmTemplate,
    changeFlowRetry,
    changeFlowToml,
    changeFlowVarValue: flowVarsInputPanelWorkspace.changeFlowVarValue,
    closeFlowNameDialog,
    executeFlowExecution,
    exportFlowExecutionExcel,
    flowPanelDisplayStateStore,
    openNewFlowDialog,
    openSaveAsFlowDialog,
    runActionHandlers,
    saveFlowTemplate,
    saveFlowTemplateAs: authoring.saveAs,
    setPanelContext,
    submitFlowNameDialog,
  };
}

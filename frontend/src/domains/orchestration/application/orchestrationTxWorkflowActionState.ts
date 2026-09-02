import { derived as deriveStore, writable } from "svelte/store";
import { currentLanguageState } from "../../../lib/i18n.js";
import { orchestrationTemplateApi } from "../infrastructure/orchestrationTemplateApi.js";
import {
  orchestrationPatchTxWorkflowAction,
  orchestrationSelectTxWorkflowActionSource,
  orchestrationTxWorkflowActionJsonFieldUpdateResult,
  orchestrationTxWorkflowFieldPatch,
} from "../model/orchestrationTxWorkflowActions.js";
import { orchestrationTxWorkflowActionSettingsPanelDisplay } from "../presentation/orchestrationActionDisplayState.js";
import {
  orchestrationCreateTxWorkflowActionModel,
  orchestrationPlanFormModelFromJson,
} from "../model/orchestrationPlanFormModels.js";
import { orchestrationVisualEditorDisplay } from "./orchestrationStageEditorsState.js";
import type {
  JsonObject,
  OrchestrationErrorChangeHandler,
  OrchestrationPlanChangeHandler,
  OrchestrationPlanFormModel,
  OrchestrationTemplateOption,
  OrchestrationTxWorkflowActionModel,
  OrchestrationTxWorkflowSourceBindings,
  OrchestrationVisualEditorDisplay,
  OrchestrationWorkflowSourceMode,
} from "../model/types.js";

const TEMPLATE_API_PATH = "/api/tx-workflow-templates";

type PlanChangeHandler = OrchestrationPlanChangeHandler;
type ErrorChangeHandler = OrchestrationErrorChangeHandler;

interface TemplateNameEntry {
  name?: string | null;
}

type TemplateListEntry = string | TemplateNameEntry | null;
type TemplateListHandler = (
  basePath: string,
) => Promise<readonly TemplateListEntry[]>;

interface TxWorkflowActionContext {
  jobIndex?: number;
  model?: OrchestrationPlanFormModel;
  onChange?: PlanChangeHandler | null;
  onErrorChange?: ErrorChangeHandler | null;
  stageIndex?: number;
}

interface TxWorkflowActionWorkspaceOptions extends TxWorkflowActionContext {
  apiListTemplates?: TemplateListHandler;
}

interface TxWorkflowActionSettingsContext {
  txWorkflow?: OrchestrationTxWorkflowActionModel;
  visualDisplay?: OrchestrationVisualEditorDisplay;
}

function planModelValue(
  value: OrchestrationPlanFormModel | undefined,
): OrchestrationPlanFormModel {
  return value ?? orchestrationPlanFormModelFromJson({});
}

function integerOr(value: number | undefined, fallback = 0): number {
  return Number.isInteger(value) ? (value ?? fallback) : fallback;
}

function errorMessage(error: unknown): string {
  return error && typeof error === "object" && "message" in error
    ? String(error.message)
    : String(error);
}

function orchestrationTxWorkflowActionBindings(
  model: OrchestrationPlanFormModel,
  stageIndex: number,
  jobIndex: number,
  onChange: PlanChangeHandler | null,
) {
  const applyChange = (nextModel: OrchestrationPlanFormModel): void => {
    onChange?.(nextModel);
  };
  return {
    setSource(sourceValue: OrchestrationWorkflowSourceMode): void {
      applyChange(
        orchestrationSelectTxWorkflowActionSource(
          model,
          stageIndex,
          jobIndex,
          sourceValue,
        ),
      );
    },
    setJsonText(workflowJsonText: string): string {
      const result = orchestrationTxWorkflowActionJsonFieldUpdateResult(
        model,
        stageIndex,
        jobIndex,
        "workflow",
        workflowJsonText,
      );
      if (typeof onChange === "function") onChange(result.model);
      return result.error;
    },
    setTemplateName(workflowTemplateName: string): void {
      applyChange(
        orchestrationPatchTxWorkflowAction(
          model,
          stageIndex,
          jobIndex,
          orchestrationTxWorkflowFieldPatch(
            "workflowTemplateName",
            workflowTemplateName,
          ),
        ),
      );
    },
    setWorkflowVars(workflowVars: JsonObject = {}): void {
      applyChange(
        orchestrationPatchTxWorkflowAction(
          model,
          stageIndex,
          jobIndex,
          orchestrationTxWorkflowFieldPatch("workflowVars", workflowVars),
        ),
      );
    },
  };
}

export function orchestrationTxWorkflowSourceBindings(
  model: OrchestrationPlanFormModel,
  stageIndex: number,
  jobIndex: number,
  onChange: PlanChangeHandler | null,
  onErrorChange: ErrorChangeHandler | null,
): OrchestrationTxWorkflowSourceBindings {
  const setFormError = (nextError = ""): void => {
    onErrorChange?.(nextError);
  };
  const actionBindings = orchestrationTxWorkflowActionBindings(
    model,
    stageIndex,
    jobIndex,
    onChange,
  );
  return {
    setSource: actionBindings.setSource,
    setJsonText(workflowJsonText: string): void {
      const error = actionBindings.setJsonText(workflowJsonText);
      setFormError(error);
    },
    setTemplateName: actionBindings.setTemplateName,
    setWorkflowVars(workflowVars: JsonObject = {}): void {
      actionBindings.setWorkflowVars(workflowVars);
      setFormError("");
    },
  };
}

export function orchestrationTxWorkflowActionEditorCallbacks(
  model: OrchestrationPlanFormModel,
  stageIndex: number,
  jobIndex: number,
  onChange: PlanChangeHandler | null,
  onErrorChange: ErrorChangeHandler | null,
) {
  const sourceBindings = orchestrationTxWorkflowSourceBindings(
    model,
    stageIndex,
    jobIndex,
    onChange,
    onErrorChange,
  );
  return {
    sourceBindings,
    sourceChange(sourceValue: string): void {
      sourceBindings.setSource(sourceValue);
    },
  };
}

function normalizeTemplateOptions(
  payload: readonly TemplateListEntry[],
): OrchestrationTemplateOption[] {
  return [
    { optionLabel: "", optionValue: "" },
    ...payload
      .map((item) => {
        if (typeof item === "string") return item;
        return item?.name;
      })
      .filter(
        (name): name is string => typeof name === "string" && !!name.trim(),
      )
      .sort((left, right) => left.localeCompare(right))
      .map((name) => ({ optionLabel: name, optionValue: name })),
  ];
}

export function createOrchestrationTxWorkflowActionEditorWorkspace({
  apiListTemplates = orchestrationTemplateApi.listTemplateResource,
  jobIndex = 0,
  model,
  onChange = null,
  onErrorChange = null,
  stageIndex = 0,
}: TxWorkflowActionWorkspaceOptions = {}) {
  const jobIndexStateStore = writable(integerOr(jobIndex));
  const modelStateStore = writable(planModelValue(model));
  const onChangeStateStore = writable<PlanChangeHandler | null>(onChange);
  const onErrorChangeStateStore = writable<ErrorChangeHandler | null>(
    onErrorChange,
  );
  const stageIndexStateStore = writable(integerOr(stageIndex));
  const templateOptionsStateStore = writable<OrchestrationTemplateOption[]>([
    { optionLabel: "", optionValue: "" },
  ]);
  const templateErrorStateStore = writable("");
  const actionCallbacksStateStore = deriveStore(
    [
      modelStateStore,
      stageIndexStateStore,
      jobIndexStateStore,
      onChangeStateStore,
      onErrorChangeStateStore,
    ],
    ([
      $modelStateStore,
      $stageIndexStateStore,
      $jobIndexStateStore,
      $onChangeStateStore,
      $onErrorChangeStateStore,
    ]) =>
      orchestrationTxWorkflowActionEditorCallbacks(
        $modelStateStore,
        $stageIndexStateStore,
        $jobIndexStateStore,
        $onChangeStateStore,
        $onErrorChangeStateStore,
      ),
  );

  async function refreshTemplateOptions(): Promise<void> {
    try {
      const payload = await apiListTemplates(TEMPLATE_API_PATH);
      templateOptionsStateStore.set(normalizeTemplateOptions(payload));
      templateErrorStateStore.set("");
    } catch (error) {
      templateErrorStateStore.set(errorMessage(error));
    }
  }

  function setTxWorkflowActionContext({
    jobIndex: nextJobIndex = 0,
    model: nextModel,
    onChange: nextOnChange = null,
    onErrorChange: nextOnErrorChange = null,
    stageIndex: nextStageIndex = 0,
  }: TxWorkflowActionContext = {}): void {
    jobIndexStateStore.set(integerOr(nextJobIndex));
    modelStateStore.set(planModelValue(nextModel));
    onChangeStateStore.set(nextOnChange);
    onErrorChangeStateStore.set(nextOnErrorChange);
    stageIndexStateStore.set(integerOr(nextStageIndex));
  }

  return {
    actionCallbacksStateStore,
    refreshTemplateOptions,
    setTxWorkflowActionContext,
    templateErrorStateStore,
    templateOptionsStateStore,
  };
}

export function createOrchestrationTxWorkflowActionSettingsEditorWorkspace({
  txWorkflow,
  visualDisplay,
}: TxWorkflowActionSettingsContext = {}) {
  const txWorkflowStateStore = writable<OrchestrationTxWorkflowActionModel>(
    txWorkflow ?? orchestrationCreateTxWorkflowActionModel(),
  );
  const visualDisplayStateStore = writable<OrchestrationVisualEditorDisplay>(
    visualDisplay ?? orchestrationVisualEditorDisplay(),
  );
  const settingsPanelDisplayStateStore = deriveStore(
    [txWorkflowStateStore, visualDisplayStateStore, currentLanguageState],
    ([$txWorkflowStateStore, $visualDisplayStateStore]) =>
      orchestrationTxWorkflowActionSettingsPanelDisplay(
        $txWorkflowStateStore,
        $visualDisplayStateStore,
      ),
  );

  function setTxWorkflowActionSettingsContext({
    txWorkflow: nextTxWorkflow,
    visualDisplay: nextVisualDisplay,
  }: TxWorkflowActionSettingsContext = {}): void {
    txWorkflowStateStore.set(
      nextTxWorkflow ?? orchestrationCreateTxWorkflowActionModel(),
    );
    visualDisplayStateStore.set(
      nextVisualDisplay ?? orchestrationVisualEditorDisplay(),
    );
  }

  return {
    settingsPanelDisplayStateStore,
    setTxWorkflowActionSettingsContext,
  };
}

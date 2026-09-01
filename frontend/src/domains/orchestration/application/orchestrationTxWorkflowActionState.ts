import { derived as deriveStore, writable } from "svelte/store";
import { currentLanguageState } from "../../../lib/i18n.js";
import { orchestrationTemplateApi } from "../infrastructure/orchestrationTemplateApi.js";
import {
  orchestrationPatchTxWorkflowAction,
  orchestrationSelectTxWorkflowActionSource,
  orchestrationTxWorkflowActionJsonFieldUpdateResult,
  orchestrationTxWorkflowFieldPatch,
  orchestrationWorkflowJsonObject,
} from "../model/orchestrationTxWorkflowActions.js";
import { orchestrationTxWorkflowActionSettingsPanelDisplay } from "../presentation/orchestrationActionDisplayState.js";
import type { OrchestrationPlanFormModel } from "../model/types.js";

const TEMPLATE_API_PATH = "/api/tx-workflow-templates";

type PlanChangeHandler = (model: OrchestrationPlanFormModel) => unknown;
type ErrorChangeHandler = (error: string) => unknown;
type TemplateListHandler = (basePath: string) => Promise<unknown>;

interface TxWorkflowActionContext {
  jobIndex?: unknown;
  model?: unknown;
  onChange?: PlanChangeHandler | null;
  onErrorChange?: ErrorChangeHandler | null;
  stageIndex?: unknown;
}

interface TxWorkflowActionWorkspaceOptions extends TxWorkflowActionContext {
  apiListTemplates?: TemplateListHandler;
}

interface TxWorkflowActionSettingsContext {
  txWorkflow?: unknown;
  visualDisplay?: unknown;
}

interface TemplateOption {
  label: string;
  value: string;
}

function planModelValue(value: unknown): OrchestrationPlanFormModel {
  return orchestrationWorkflowJsonObject(value) as OrchestrationPlanFormModel;
}

function integerOr(value: unknown, fallback = 0): number {
  return Number.isInteger(value) ? (value as number) : fallback;
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
  const applyChange = (nextModel: OrchestrationPlanFormModel): unknown =>
    typeof onChange === "function" ? onChange(nextModel) : undefined;
  return {
    setSource(sourceValue: unknown): void {
      applyChange(
        orchestrationSelectTxWorkflowActionSource(
          model,
          stageIndex,
          jobIndex,
          sourceValue,
        ),
      );
    },
    setJsonText(workflowJsonText: unknown): string {
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
    setTemplateName(workflowTemplateName: unknown): void {
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
    setWorkflowVars(workflowVars: unknown = {}): void {
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
) {
  const setFormError = (nextError = ""): unknown =>
    typeof onErrorChange === "function" ? onErrorChange(nextError) : undefined;
  const actionBindings = orchestrationTxWorkflowActionBindings(
    model,
    stageIndex,
    jobIndex,
    onChange,
  );
  return {
    setSource: actionBindings.setSource,
    setJsonText(workflowJsonText: unknown): void {
      const error = actionBindings.setJsonText(workflowJsonText);
      setFormError(error);
    },
    setTemplateName: actionBindings.setTemplateName,
    setWorkflowVars(workflowVars: unknown = {}): void {
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
    sourceChange(sourceValue: unknown): void {
      sourceBindings.setSource(sourceValue);
    },
  };
}

function normalizeTemplateOptions(payload: unknown): TemplateOption[] {
  return [
    { label: "", value: "" },
    ...(Array.isArray(payload) ? payload : [])
      .map((item) => {
        if (typeof item === "string") return item;
        const row = orchestrationWorkflowJsonObject(item);
        return row.name;
      })
      .filter(
        (name): name is string => typeof name === "string" && !!name.trim(),
      )
      .sort((left, right) => left.localeCompare(right))
      .map((name) => ({ label: name, value: name })),
  ];
}

export function createOrchestrationTxWorkflowActionEditorWorkspace({
  apiListTemplates = orchestrationTemplateApi.listTemplateResource,
  jobIndex = 0,
  model = {},
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
  const templateOptionsStateStore = writable<TemplateOption[]>([
    { label: "", value: "" },
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
    model: nextModel = {},
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
  txWorkflow = {},
  visualDisplay = {},
}: TxWorkflowActionSettingsContext = {}) {
  const txWorkflowStateStore = writable(
    orchestrationWorkflowJsonObject(txWorkflow),
  );
  const visualDisplayStateStore = writable(
    orchestrationWorkflowJsonObject(visualDisplay),
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
    txWorkflow: nextTxWorkflow = {},
    visualDisplay: nextVisualDisplay = {},
  }: TxWorkflowActionSettingsContext = {}): void {
    txWorkflowStateStore.set(orchestrationWorkflowJsonObject(nextTxWorkflow));
    visualDisplayStateStore.set(
      orchestrationWorkflowJsonObject(nextVisualDisplay),
    );
  }

  return {
    settingsPanelDisplayStateStore,
    setTxWorkflowActionSettingsContext,
  };
}

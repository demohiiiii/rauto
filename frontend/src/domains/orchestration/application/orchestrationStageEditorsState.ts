import { derived as deriveStore, writable } from "svelte/store";
import { callIfFunction } from "../../../lib/events.js";
import { currentLanguageState, t } from "../../../lib/i18n.js";
import {
  TX_BLOCK_BOOLEAN_ROWS,
  TX_BLOCK_JSON_VALUE_TYPE_ROWS,
} from "$domains/transactions/index.js";
import { orchestrationPatchValueChangeHandler } from "./orchestrationFormState.js";
import {
  orchestrationAddJob,
  orchestrationAddStage,
  orchestrationChangeRoot,
  orchestrationPatchJob,
  orchestrationPatchStage,
  orchestrationRemoveJob,
  orchestrationRemoveStage,
} from "../model/orchestrationStageMutations.js";
import {
  orchestrationCreateJobModel,
  orchestrationPlanFormModelFromJson,
  orchestrationCreateStageModel,
} from "../model/orchestrationPlanFormModels.js";
import {
  orchestrationJsonFieldText,
  orchestrationJobFieldPatch,
  orchestrationStageFieldPatch,
} from "../presentation/orchestrationFormFieldState.js";
import {
  orchestrationJobEditorDisplay,
  orchestrationJobSettingsPanelDisplay,
  orchestrationPlanSettingsPanelDisplay,
  orchestrationStageSettingsPanelDisplay,
  orchestrationStagesPanelDisplay,
} from "../presentation/orchestrationFormStructureState.js";
import { orchestrationTxWorkflowActionSourceValue } from "../presentation/orchestrationActionDisplayState.js";
import type {
  OrchestrationJobEditorRow,
  OrchestrationJobModel,
  OrchestrationPlanChangeHandler,
  OrchestrationPlanFormModel,
  OrchestrationStageEditorRow,
  OrchestrationVisualEditorDisplay,
} from "../model/types.js";

type PlanChangeHandler = OrchestrationPlanChangeHandler;
type PlanFieldPatchFactory = (
  fieldKey: string,
  value: string,
) => OrchestrationPlanFormModel;

interface ModelChangeContext {
  model?: OrchestrationPlanFormModel;
  onChange?: PlanChangeHandler | null;
}

interface VisualModelChangeContext extends ModelChangeContext {
  visualDisplay?: OrchestrationVisualEditorDisplay;
}

interface StageEditorContext extends VisualModelChangeContext {
  stageRow?: OrchestrationStageEditorRow;
}

interface JobSettingsEditorContext extends VisualModelChangeContext {
  job?: OrchestrationJobModel;
  jobIndex?: number;
  stageIndex?: number;
}

interface JobEditorContext {
  jobRow?: OrchestrationJobEditorRow;
}

function planModelValue(
  value: OrchestrationPlanFormModel | undefined,
): OrchestrationPlanFormModel {
  return value ?? orchestrationPlanFormModelFromJson({});
}

function stageStateIntegerOr(value: number | undefined, fallback = 0): number {
  return Number.isInteger(value) ? (value ?? fallback) : fallback;
}

function notifyPlanChange(
  onChange: PlanChangeHandler | null | undefined,
  model: OrchestrationPlanFormModel,
): void {
  callIfFunction(onChange, model);
}

function orchestrationJobEditorRow(
  job: OrchestrationJobModel,
  stageIndex: number,
  jobIndex: number,
): OrchestrationJobEditorRow {
  return {
    job,
    stageIndex,
    jobIndex,
    titleText: `${t("orchestrationFormJob")} ${jobIndex + 1}`,
    txWorkflowRows: {
      sourceValue: orchestrationTxWorkflowActionSourceValue(
        job.action.txWorkflow,
      ),
      workflowVarsText: orchestrationJsonFieldText(
        job.action.txWorkflow.workflowVars,
        {},
      ),
    },
  };
}

export function orchestrationVisualEditorDisplay(
  model: OrchestrationPlanFormModel = orchestrationPlanFormModelFromJson(),
): OrchestrationVisualEditorDisplay {
  const modelValue = model;
  const stages = Array.isArray(modelValue.stages) ? modelValue.stages : [];
  return {
    txWorkflowActionSourceRows: ["workflow_json", "workflow_template_name"],
    booleanRows: TX_BLOCK_BOOLEAN_ROWS,
    jsonValueTypeRows: TX_BLOCK_JSON_VALUE_TYPE_ROWS,
    nullableBooleanRows: ["", ...TX_BLOCK_BOOLEAN_ROWS],
    strategyRows: ["serial", "parallel"],
    stageRows: stages.map((stage, stageIndex): OrchestrationStageEditorRow => {
      const jobs = Array.isArray(stage.jobs) ? stage.jobs : [];
      return {
        stage,
        stageIndex,
        titleText: `${t("orchestrationFormStage")} ${stageIndex + 1}`,
        jobRows: jobs.map((job, jobIndex) =>
          orchestrationJobEditorRow(job, stageIndex, jobIndex),
        ),
      };
    }),
  };
}

function orchestrationFieldCallbacks(
  onChange: PlanChangeHandler | null,
  patchValue: PlanFieldPatchFactory,
) {
  return {
    fieldValueHandler(fieldKey: string) {
      return orchestrationPatchValueChangeHandler(onChange, (value) =>
        patchValue(fieldKey, value),
      );
    },
  };
}

function orchestrationStagesPanelCallbacks(
  model: OrchestrationPlanFormModel,
  onChange: PlanChangeHandler | null,
) {
  return {
    addStage() {
      return notifyPlanChange(onChange, orchestrationAddStage(model));
    },
    removeStageHandler(stageIndex: number = 0) {
      return () =>
        notifyPlanChange(onChange, orchestrationRemoveStage(model, stageIndex));
    },
  };
}

function orchestrationStageEditorCallbacks(
  model: OrchestrationPlanFormModel,
  stageIndex: number,
  onChange: PlanChangeHandler | null,
) {
  return {
    addJob() {
      return notifyPlanChange(onChange, orchestrationAddJob(model, stageIndex));
    },
    ...orchestrationFieldCallbacks(onChange, (fieldKey, value) =>
      orchestrationPatchStage(
        model,
        stageIndex,
        orchestrationStageFieldPatch(fieldKey, value),
      ),
    ),
    removeJobHandler(jobIndex: number) {
      return () =>
        notifyPlanChange(
          onChange,
          orchestrationRemoveJob(model, stageIndex, jobIndex),
        );
    },
  };
}

export function orchestrationJobSettingsCallbacks(
  model: OrchestrationPlanFormModel,
  stageIndex: number,
  jobIndex: number,
  onChange: PlanChangeHandler | null,
) {
  return orchestrationFieldCallbacks(onChange, (fieldKey, value) =>
    orchestrationPatchJob(
      model,
      stageIndex,
      jobIndex,
      orchestrationJobFieldPatch(fieldKey, value),
    ),
  );
}

export function createOrchestrationJobEditorWorkspace({
  jobRow,
}: JobEditorContext = {}) {
  const jobRowStateStore = writable<OrchestrationJobEditorRow>(
    jobRow ?? orchestrationJobEditorRow(orchestrationCreateJobModel(), 0, 0),
  );
  const jobEditorDisplayStateStore = deriveStore(
    [jobRowStateStore, currentLanguageState],
    ([$jobRowStateStore]) => orchestrationJobEditorDisplay($jobRowStateStore),
  );

  function setJobRow(nextJobRow: OrchestrationJobEditorRow) {
    jobRowStateStore.set(nextJobRow);
  }

  return {
    jobEditorDisplayStateStore,
    jobRowStateStore,
    setJobRow,
  };
}

export function createOrchestrationStagesPanelWorkspace({
  model,
  onChange = null,
}: ModelChangeContext = {}) {
  const modelStateStore = writable(planModelValue(model));
  const onChangeStateStore = writable<PlanChangeHandler | null>(onChange);
  const visualDisplayStateStore = deriveStore(
    [modelStateStore, currentLanguageState],
    ([$modelStateStore]) => orchestrationVisualEditorDisplay($modelStateStore),
  );
  const stagesPanelDisplayStateStore = deriveStore(
    [visualDisplayStateStore, currentLanguageState],
    ([$visualDisplayStateStore]) =>
      orchestrationStagesPanelDisplay($visualDisplayStateStore),
  );
  const panelCallbacksStateStore = deriveStore(
    [modelStateStore, onChangeStateStore],
    ([$modelStateStore, $onChangeStateStore]) =>
      orchestrationStagesPanelCallbacks($modelStateStore, $onChangeStateStore),
  );
  return {
    panelCallbacksStateStore,
    setStagesPanelContext({
      model: nextModel,
      onChange: nextOnChange = null,
    }: ModelChangeContext = {}) {
      modelStateStore.set(planModelValue(nextModel));
      onChangeStateStore.set(nextOnChange);
    },
    stagesPanelDisplayStateStore,
    visualDisplayStateStore,
  };
}

export function createOrchestrationPlanSettingsEditorWorkspace({
  model,
  onChange = null,
  visualDisplay,
}: VisualModelChangeContext = {}) {
  const modelStateStore = writable(planModelValue(model));
  const onChangeStateStore = writable<PlanChangeHandler | null>(onChange);
  const visualDisplayStateStore = writable<OrchestrationVisualEditorDisplay>(
    visualDisplay ?? orchestrationVisualEditorDisplay(),
  );
  const settingsPanelDisplayStateStore = deriveStore(
    [modelStateStore, visualDisplayStateStore, currentLanguageState],
    ([$modelStateStore, $visualDisplayStateStore]) =>
      orchestrationPlanSettingsPanelDisplay(
        $modelStateStore,
        $visualDisplayStateStore,
      ),
  );
  const planSettingsCallbacksStateStore = deriveStore(
    [modelStateStore, onChangeStateStore],
    ([$modelStateStore, $onChangeStateStore]) =>
      orchestrationFieldCallbacks($onChangeStateStore, (fieldKey, value) =>
        orchestrationChangeRoot($modelStateStore, fieldKey, value),
      ),
  );

  function setPlanSettingsContext({
    model: nextModel,
    onChange: nextOnChange = null,
    visualDisplay: nextVisualDisplay,
  }: VisualModelChangeContext = {}) {
    modelStateStore.set(planModelValue(nextModel));
    onChangeStateStore.set(nextOnChange);
    visualDisplayStateStore.set(
      nextVisualDisplay ?? orchestrationVisualEditorDisplay(),
    );
  }

  return {
    planSettingsCallbacksStateStore,
    settingsPanelDisplayStateStore,
    setPlanSettingsContext,
  };
}

export function createOrchestrationStageEditorWorkspace({
  model,
  onChange = null,
  stageRow,
  visualDisplay,
}: StageEditorContext = {}) {
  const modelStateStore = writable(planModelValue(model));
  const onChangeStateStore = writable<PlanChangeHandler | null>(onChange);
  const stageRowStateStore = writable<OrchestrationStageEditorRow>(
    stageRow ?? {
      jobRows: [],
      stage: orchestrationCreateStageModel(),
      stageIndex: 0,
      titleText: "",
    },
  );
  const visualDisplayStateStore = writable<OrchestrationVisualEditorDisplay>(
    visualDisplay ?? orchestrationVisualEditorDisplay(),
  );
  const settingsPanelDisplayStateStore = deriveStore(
    [stageRowStateStore, visualDisplayStateStore, currentLanguageState],
    ([$stageRowStateStore, $visualDisplayStateStore]) =>
      orchestrationStageSettingsPanelDisplay(
        $stageRowStateStore,
        $visualDisplayStateStore,
      ),
  );
  const stageEditorCallbacksStateStore = deriveStore(
    [modelStateStore, onChangeStateStore, stageRowStateStore],
    ([$modelStateStore, $onChangeStateStore, $stageRowStateStore]) =>
      orchestrationStageEditorCallbacks(
        $modelStateStore,
        stageStateIntegerOr($stageRowStateStore.stageIndex),
        $onChangeStateStore,
      ),
  );

  function setStageContext({
    model: nextModel,
    onChange: nextOnChange = null,
    stageRow: nextStageRow,
    visualDisplay: nextVisualDisplay,
  }: StageEditorContext = {}) {
    modelStateStore.set(planModelValue(nextModel));
    onChangeStateStore.set(nextOnChange);
    stageRowStateStore.set(
      nextStageRow ?? {
        jobRows: [],
        stage: orchestrationCreateStageModel(),
        stageIndex: 0,
        titleText: "",
      },
    );
    visualDisplayStateStore.set(
      nextVisualDisplay ?? orchestrationVisualEditorDisplay(),
    );
  }

  return {
    settingsPanelDisplayStateStore,
    stageEditorCallbacksStateStore,
    stageRowStateStore,
    setStageContext,
  };
}

export function createOrchestrationJobSettingsEditorWorkspace({
  job,
  jobIndex = 0,
  model,
  onChange = null,
  stageIndex = 0,
  visualDisplay,
}: JobSettingsEditorContext = {}) {
  const modelStateStore = writable(planModelValue(model));
  const onChangeStateStore = writable<PlanChangeHandler | null>(onChange);
  const jobStateStore = writable<OrchestrationJobModel>(
    job ?? orchestrationCreateJobModel(),
  );
  const jobIndexStateStore = writable(stageStateIntegerOr(jobIndex));
  const stageIndexStateStore = writable(stageStateIntegerOr(stageIndex));
  const visualDisplayStateStore = writable<OrchestrationVisualEditorDisplay>(
    visualDisplay ?? orchestrationVisualEditorDisplay(),
  );
  const settingsPanelDisplayStateStore = deriveStore(
    [jobStateStore, visualDisplayStateStore, currentLanguageState],
    ([$jobStateStore, $visualDisplayStateStore]) =>
      orchestrationJobSettingsPanelDisplay(
        $jobStateStore,
        $visualDisplayStateStore,
      ),
  );
  const jobSettingsCallbacksStateStore = deriveStore(
    [
      modelStateStore,
      onChangeStateStore,
      stageIndexStateStore,
      jobIndexStateStore,
    ],
    ([
      $modelStateStore,
      $onChangeStateStore,
      $stageIndexStateStore,
      $jobIndexStateStore,
    ]) =>
      orchestrationJobSettingsCallbacks(
        $modelStateStore,
        $stageIndexStateStore,
        $jobIndexStateStore,
        $onChangeStateStore,
      ),
  );

  function setJobSettingsContext({
    job: nextJob,
    jobIndex: nextJobIndex = 0,
    model: nextModel,
    onChange: nextOnChange = null,
    stageIndex: nextStageIndex = 0,
    visualDisplay: nextVisualDisplay,
  }: JobSettingsEditorContext = {}) {
    jobStateStore.set(nextJob ?? orchestrationCreateJobModel());
    jobIndexStateStore.set(stageStateIntegerOr(nextJobIndex));
    modelStateStore.set(planModelValue(nextModel));
    onChangeStateStore.set(nextOnChange);
    stageIndexStateStore.set(stageStateIntegerOr(nextStageIndex));
    visualDisplayStateStore.set(
      nextVisualDisplay ?? orchestrationVisualEditorDisplay(),
    );
  }

  return {
    jobSettingsCallbacksStateStore,
    settingsPanelDisplayStateStore,
    setJobSettingsContext,
  };
}

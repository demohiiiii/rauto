import { derived as deriveStore, writable } from "svelte/store";
import { callIfFunction } from "../../lib/events.js";
import { currentLanguageState, t } from "../../lib/i18n.js";
import {
  TX_BLOCK_BOOLEAN_ROWS,
  TX_BLOCK_JSON_VALUE_TYPE_ROWS,
} from "../transactions/transactionBlockDisplays.js";
import { orchestrationPatchValueChangeHandler } from "./orchestrationFormState.js";
import {
  orchestrationJsonFieldText,
  orchestrationJobEditorDisplay,
  orchestrationJobFieldPatch,
  orchestrationJobSettingsPanelDisplay,
  orchestrationPlanSettingsPanelDisplay,
  orchestrationStageFieldPatch,
  orchestrationStageSettingsPanelDisplay,
  orchestrationStagesPanelDisplay,
} from "./orchestrationFormDisplayState.js";
import { orchestrationTxWorkflowActionSourceValue } from "./orchestrationActionDisplayState.js";
import {
  orchestrationAddJob,
  orchestrationAddStage,
  orchestrationChangeRoot,
  orchestrationPatchJob,
  orchestrationPatchStage,
  orchestrationRemoveJob,
  orchestrationRemoveStage,
} from "./orchestrationStageMutations.js";

function stageStateObjectOrEmpty(value) {
  return value && typeof value === "object" ? value : {};
}

function stageStateIntegerOr(value, fallback = 0) {
  return Number.isInteger(value) ? value : fallback;
}

function orchestrationJobEditorRow(job = {}, stageIndex, jobIndex) {
  return {
    job,
    stageIndex,
    jobIndex,
    titleText: `${t("orchestrationFormJob")} ${jobIndex + 1}`,
    txWorkflowRows: {
      sourceValue: orchestrationTxWorkflowActionSourceValue(
        job.action?.txWorkflow || {},
      ),
      workflowVarsText: orchestrationJsonFieldText(
        job.action?.txWorkflow?.workflowVars,
        {},
      ),
    },
  };
}

export function orchestrationVisualEditorDisplay(model = {}) {
  const stages = Array.isArray(model.stages) ? model.stages : [];
  return {
    txWorkflowActionSourceRows: ["workflow_json", "workflow_template_name"],
    booleanRows: TX_BLOCK_BOOLEAN_ROWS,
    jsonValueTypeRows: TX_BLOCK_JSON_VALUE_TYPE_ROWS,
    nullableBooleanRows: ["", ...TX_BLOCK_BOOLEAN_ROWS],
    strategyRows: ["serial", "parallel"],
    stageRows: stages.map((stage, stageIndex) => {
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

function orchestrationFieldCallbacks(onChange, patchValue) {
  return {
    fieldValueHandler(fieldKey) {
      return orchestrationPatchValueChangeHandler(onChange, (value) =>
        patchValue(fieldKey, value),
      );
    },
  };
}

function orchestrationStagesPanelCallbacks(model, onChange) {
  return {
    addStage() {
      return callIfFunction(onChange, orchestrationAddStage(model));
    },
    removeStageHandler(stageIndex = 0) {
      return () =>
        callIfFunction(onChange, orchestrationRemoveStage(model, stageIndex));
    },
  };
}

function orchestrationStageEditorCallbacks(model, stageIndex, onChange) {
  return {
    addJob() {
      return callIfFunction(onChange, orchestrationAddJob(model, stageIndex));
    },
    ...orchestrationFieldCallbacks(onChange, (fieldKey, value) =>
      orchestrationPatchStage(
        model,
        stageIndex,
        orchestrationStageFieldPatch(fieldKey, value),
      ),
    ),
    removeJobHandler(jobIndex) {
      return () =>
        callIfFunction(
          onChange,
          orchestrationRemoveJob(model, stageIndex, jobIndex),
        );
    },
  };
}

export function orchestrationJobSettingsCallbacks(
  model,
  stageIndex,
  jobIndex,
  onChange,
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

export function createOrchestrationJobEditorWorkspace({ jobRow = {} } = {}) {
  const jobRowStateStore = writable(stageStateObjectOrEmpty(jobRow));
  const jobEditorDisplayStateStore = deriveStore(
    [jobRowStateStore, currentLanguageState],
    ([$jobRowStateStore]) => orchestrationJobEditorDisplay($jobRowStateStore),
  );

  function setJobRow(nextJobRow = {}) {
    jobRowStateStore.set(stageStateObjectOrEmpty(nextJobRow));
  }

  return {
    jobEditorDisplayStateStore,
    jobRowStateStore,
    setJobRow,
  };
}

export function createOrchestrationStagesPanelWorkspace({
  model = {},
  onChange = null,
} = {}) {
  const modelStateStore = writable(stageStateObjectOrEmpty(model));
  const onChangeStateStore = writable(onChange);
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
      model: nextModel = {},
      onChange: nextOnChange = null,
    } = {}) {
      modelStateStore.set(stageStateObjectOrEmpty(nextModel));
      onChangeStateStore.set(nextOnChange);
    },
    stagesPanelDisplayStateStore,
    visualDisplayStateStore,
  };
}

export function createOrchestrationPlanSettingsEditorWorkspace({
  model = {},
  onChange = null,
  visualDisplay = {},
} = {}) {
  const modelStateStore = writable(stageStateObjectOrEmpty(model));
  const onChangeStateStore = writable(onChange);
  const visualDisplayStateStore = writable(
    stageStateObjectOrEmpty(visualDisplay),
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
    model: nextModel = {},
    onChange: nextOnChange = null,
    visualDisplay: nextVisualDisplay = {},
  } = {}) {
    modelStateStore.set(stageStateObjectOrEmpty(nextModel));
    onChangeStateStore.set(nextOnChange);
    visualDisplayStateStore.set(stageStateObjectOrEmpty(nextVisualDisplay));
  }

  return {
    planSettingsCallbacksStateStore,
    settingsPanelDisplayStateStore,
    setPlanSettingsContext,
  };
}

export function createOrchestrationStageEditorWorkspace({
  model = {},
  onChange = null,
  stageRow = {},
  visualDisplay = {},
} = {}) {
  const modelStateStore = writable(stageStateObjectOrEmpty(model));
  const onChangeStateStore = writable(onChange);
  const stageRowStateStore = writable(stageStateObjectOrEmpty(stageRow));
  const visualDisplayStateStore = writable(
    stageStateObjectOrEmpty(visualDisplay),
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
        $stageRowStateStore.stageIndex ?? 0,
        $onChangeStateStore,
      ),
  );

  function setStageContext({
    model: nextModel = {},
    onChange: nextOnChange = null,
    stageRow: nextStageRow = {},
    visualDisplay: nextVisualDisplay = {},
  } = {}) {
    modelStateStore.set(stageStateObjectOrEmpty(nextModel));
    onChangeStateStore.set(nextOnChange);
    stageRowStateStore.set(stageStateObjectOrEmpty(nextStageRow));
    visualDisplayStateStore.set(stageStateObjectOrEmpty(nextVisualDisplay));
  }

  return {
    settingsPanelDisplayStateStore,
    stageEditorCallbacksStateStore,
    stageRowStateStore,
    setStageContext,
  };
}

export function createOrchestrationJobSettingsEditorWorkspace({
  job = {},
  jobIndex = 0,
  model = {},
  onChange = null,
  stageIndex = 0,
  visualDisplay = {},
} = {}) {
  const modelStateStore = writable(stageStateObjectOrEmpty(model));
  const onChangeStateStore = writable(onChange);
  const jobStateStore = writable(stageStateObjectOrEmpty(job));
  const jobIndexStateStore = writable(stageStateIntegerOr(jobIndex));
  const stageIndexStateStore = writable(stageStateIntegerOr(stageIndex));
  const visualDisplayStateStore = writable(
    stageStateObjectOrEmpty(visualDisplay),
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
    job: nextJob = {},
    jobIndex: nextJobIndex = 0,
    model: nextModel = {},
    onChange: nextOnChange = null,
    stageIndex: nextStageIndex = 0,
    visualDisplay: nextVisualDisplay = {},
  } = {}) {
    jobStateStore.set(stageStateObjectOrEmpty(nextJob));
    jobIndexStateStore.set(stageStateIntegerOr(nextJobIndex));
    modelStateStore.set(stageStateObjectOrEmpty(nextModel));
    onChangeStateStore.set(nextOnChange);
    stageIndexStateStore.set(stageStateIntegerOr(nextStageIndex));
    visualDisplayStateStore.set(stageStateObjectOrEmpty(nextVisualDisplay));
  }

  return {
    jobSettingsCallbacksStateStore,
    settingsPanelDisplayStateStore,
    setJobSettingsContext,
  };
}

import { derived as deriveStore, writable } from "svelte/store";
import { callIfFunction } from "../lib/events.js";
import { currentLanguageState, t } from "../lib/i18n.js";
import {
  TX_BLOCK_BOOLEAN_ROWS,
  TX_BLOCK_JSON_VALUE_TYPE_ROWS,
} from "./transactionBlockDisplays.js";
import {
  orchestrationCloneFormModel,
  orchestrationCreateJobModel,
  orchestrationExtraStringPresenceChangeHandler,
  orchestrationExtraStringValueChangeHandler,
  orchestrationNullableFieldModePatch,
  orchestrationPatchPresenceChangeHandler,
  orchestrationPatchValueChangeHandler,
} from "./orchestrationForms.js";
import {
  orchestrationJsonFieldText,
  orchestrationJobEditorDisplay,
  orchestrationJobFieldPatch,
  orchestrationJobSettingsPanelDisplay,
  orchestrationPlanSettingsPanelDisplay,
  orchestrationStageFieldPatch,
  orchestrationStageSettingsPanelDisplay,
  orchestrationStagesPanelDisplay,
  orchestrationTextListRows,
  orchestrationTextListValue,
} from "./orchestrationFormDisplayState.js";
import {
  orchestrationJobActionEditorDisplay,
  orchestrationTxBlockActionRows,
  orchestrationTxWorkflowActionSourceValue,
} from "./orchestrationActionDisplayState.js";
import { orchestrationTargetRows } from "./orchestrationInventoryState.js";
import {
  orchestrationAddJob,
  orchestrationAddStage,
  orchestrationChangeRoot,
  orchestrationJobTargetVarsUpdateResult,
  orchestrationPatchActionKind,
  orchestrationPatchJob,
  orchestrationPatchStage,
  orchestrationRemoveJob,
  orchestrationRemoveStage,
  orchestrationSetJobFieldPresence,
  orchestrationSetRootFieldPresence,
  orchestrationSetStageFieldPresence,
} from "./orchestrationStageMutations.js";

export { orchestrationJobTargetVarsUpdateResult } from "./orchestrationStageMutations.js";

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
    targetGroupRows: orchestrationTextListRows(job.targetGroups),
    targetGroupsText: orchestrationTextListValue(job.targetGroups),
    targetTagRows: orchestrationTextListRows(job.targetTags),
    targetTagsText: orchestrationTextListValue(job.targetTags),
    targetRows: orchestrationTargetRows(job.targets, stageIndex, jobIndex),
    txBlockRows: orchestrationTxBlockActionRows(
      job.action?.txBlock || {},
      stageIndex,
      jobIndex,
    ),
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
    txBlockActionSourceRows: [
      "direct",
      "tx_block_template_name",
      "tx_block_template_content",
      "flow_template_name",
      "flow_template_content",
    ],
    txWorkflowActionSourceRows: [
      "workflow_json",
      "workflow_file",
      "workflow_template_name",
      "workflow_template_content",
    ],
    booleanRows: TX_BLOCK_BOOLEAN_ROWS,
    jsonValueTypeRows: TX_BLOCK_JSON_VALUE_TYPE_ROWS,
    nullableBooleanRows: ["", ...TX_BLOCK_BOOLEAN_ROWS],
    strategyRows: ["serial", "parallel"],
    actionKindRows: ["tx_block", "tx_workflow"],
    targetInputKindRows: ["connection", "detailed"],
    groupRows: (model.inventory?.groups || []).map((group, groupIndex) => ({
      group,
      groupIndex,
      titleText: `${t("orchestrationFormInventoryGroup")} ${groupIndex + 1}`,
    })),
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

export function orchestrationPlanSettingsBindings(model, onChange) {
  const applyChange = (nextModel) =>
    typeof onChange === "function" ? onChange(nextModel) : undefined;
  return {
    setRootExtra(extra) {
      applyChange(orchestrationChangeRoot(model, "extra", extra));
    },
    setRootField(fieldKey, fieldValue) {
      applyChange(orchestrationChangeRoot(model, fieldKey, fieldValue));
    },
    setRootFieldMode(fieldKey, mode) {
      applyChange({
        ...orchestrationCloneFormModel(model),
        ...orchestrationNullableFieldModePatch(model, fieldKey, mode),
      });
    },
    setRootFieldPresence(field, enabled) {
      applyChange(orchestrationSetRootFieldPresence(model, field, enabled));
    },
  };
}

function orchestrationPlanSettingsCallbacks(model, extraSource, onChange) {
  function setExtra(extra) {
    return callIfFunction(
      onChange,
      orchestrationChangeRoot(model, "extra", extra),
    );
  }
  return {
    fieldPresenceHandler(fieldKey) {
      return orchestrationPatchPresenceChangeHandler(onChange, (enabled) =>
        orchestrationSetRootFieldPresence(model, fieldKey, enabled),
      );
    },
    fieldValueHandler(fieldKey) {
      return orchestrationPatchValueChangeHandler(onChange, (value) =>
        orchestrationChangeRoot(model, fieldKey, value),
      );
    },
    fieldNullableModeHandler(fieldKey) {
      return orchestrationPatchValueChangeHandler(onChange, (mode) => ({
        ...orchestrationCloneFormModel(model),
        ...orchestrationNullableFieldModePatch(model, fieldKey, mode),
      }));
    },
    metadataPresenceHandler(fieldKey) {
      return orchestrationExtraStringPresenceChangeHandler(
        setExtra,
        extraSource,
        fieldKey,
      );
    },
    metadataValueHandler(fieldKey) {
      return orchestrationExtraStringValueChangeHandler(
        setExtra,
        extraSource,
        fieldKey,
      );
    },
    setExtra,
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

function orchestrationStageEditorCallbacks(
  model,
  stageIndex,
  extraSource,
  onChange,
) {
  function patchStage(patch = {}) {
    return callIfFunction(
      onChange,
      orchestrationPatchStage(model, stageIndex, patch),
    );
  }
  return {
    addJob() {
      return callIfFunction(onChange, orchestrationAddJob(model, stageIndex));
    },
    fieldPresenceHandler(fieldKey) {
      return orchestrationPatchPresenceChangeHandler(onChange, (enabled) =>
        orchestrationSetStageFieldPresence(
          model,
          stageIndex,
          fieldKey,
          enabled,
        ),
      );
    },
    fieldValueHandler(fieldKey) {
      return orchestrationPatchValueChangeHandler(onChange, (value) =>
        orchestrationPatchStage(
          model,
          stageIndex,
          orchestrationStageFieldPatch(fieldKey, value),
        ),
      );
    },
    metadataPresenceHandler(fieldKey) {
      return orchestrationExtraStringPresenceChangeHandler(
        patchStage,
        extraSource,
        fieldKey,
        (extra) => ({ extra }),
      );
    },
    metadataValueHandler(fieldKey) {
      return orchestrationExtraStringValueChangeHandler(
        patchStage,
        extraSource,
        fieldKey,
        (extra) => ({ extra }),
      );
    },
    removeJobHandler(jobIndex) {
      return () =>
        callIfFunction(
          onChange,
          orchestrationRemoveJob(model, stageIndex, jobIndex),
        );
    },
    setExtra(extra) {
      return patchStage({ extra });
    },
  };
}

export function orchestrationJobSettingsCallbacks(
  model,
  stageIndex,
  jobIndex,
  extraSource,
  onChange,
) {
  function patchJob(patch = {}) {
    return callIfFunction(
      onChange,
      orchestrationPatchJob(model, stageIndex, jobIndex, patch),
    );
  }
  return {
    fieldPresenceHandler(fieldKey) {
      return orchestrationPatchPresenceChangeHandler(onChange, (enabled) =>
        orchestrationSetJobFieldPresence(
          model,
          stageIndex,
          jobIndex,
          fieldKey,
          enabled,
        ),
      );
    },
    fieldValueHandler(fieldKey) {
      return orchestrationPatchValueChangeHandler(onChange, (value) =>
        orchestrationPatchJob(
          model,
          stageIndex,
          jobIndex,
          orchestrationJobFieldPatch(fieldKey, value),
        ),
      );
    },
    fieldNullableModeHandler(fieldKey) {
      return orchestrationPatchValueChangeHandler(onChange, (mode) =>
        orchestrationPatchJob(
          model,
          stageIndex,
          jobIndex,
          orchestrationNullableFieldModePatch(
            model?.stages?.[stageIndex]?.jobs?.[jobIndex] ||
              orchestrationCreateJobModel(),
            fieldKey,
            mode,
          ),
        ),
      );
    },
    metadataPresenceHandler(fieldKey) {
      return orchestrationExtraStringPresenceChangeHandler(
        patchJob,
        extraSource,
        fieldKey,
        (extra) => ({ extra }),
      );
    },
    metadataValueHandler(fieldKey) {
      return orchestrationExtraStringValueChangeHandler(
        patchJob,
        extraSource,
        fieldKey,
        (extra) => ({ extra }),
      );
    },
    setExtra(extra) {
      return patchJob({ extra });
    },
  };
}

export function orchestrationJobActionEditorCallbacks(
  model,
  stageIndex,
  jobIndex,
  onChange,
) {
  return {
    actionKindChange: orchestrationPatchValueChangeHandler(onChange, (value) =>
      orchestrationPatchActionKind(model, stageIndex, jobIndex, value),
    ),
  };
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
    [modelStateStore, onChangeStateStore, settingsPanelDisplayStateStore],
    ([
      $modelStateStore,
      $onChangeStateStore,
      $settingsPanelDisplayStateStore,
    ]) =>
      orchestrationPlanSettingsCallbacks(
        $modelStateStore,
        $settingsPanelDisplayStateStore.extraField.source,
        $onChangeStateStore,
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
    [
      modelStateStore,
      onChangeStateStore,
      stageRowStateStore,
      settingsPanelDisplayStateStore,
    ],
    ([
      $modelStateStore,
      $onChangeStateStore,
      $stageRowStateStore,
      $settingsPanelDisplayStateStore,
    ]) =>
      orchestrationStageEditorCallbacks(
        $modelStateStore,
        $stageRowStateStore.stageIndex ?? 0,
        $settingsPanelDisplayStateStore.extraField.source,
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
      settingsPanelDisplayStateStore,
    ],
    ([
      $modelStateStore,
      $onChangeStateStore,
      $stageIndexStateStore,
      $jobIndexStateStore,
      $settingsPanelDisplayStateStore,
    ]) =>
      orchestrationJobSettingsCallbacks(
        $modelStateStore,
        $stageIndexStateStore,
        $jobIndexStateStore,
        $settingsPanelDisplayStateStore.extraField.source,
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

export function createOrchestrationJobActionEditorWorkspace({
  jobIndex = 0,
  jobRow = {},
  model = {},
  onChange = null,
  stageIndex = 0,
  visualDisplay = {},
} = {}) {
  const jobIndexStateStore = writable(stageStateIntegerOr(jobIndex));
  const jobRowStateStore = writable(stageStateObjectOrEmpty(jobRow));
  const modelStateStore = writable(stageStateObjectOrEmpty(model));
  const onChangeStateStore = writable(onChange);
  const stageIndexStateStore = writable(stageStateIntegerOr(stageIndex));
  const visualDisplayStateStore = writable(
    stageStateObjectOrEmpty(visualDisplay),
  );
  const actionEditorDisplayStateStore = deriveStore(
    [jobRowStateStore, visualDisplayStateStore, currentLanguageState],
    ([$jobRowStateStore, $visualDisplayStateStore]) =>
      orchestrationJobActionEditorDisplay(
        $jobRowStateStore,
        $visualDisplayStateStore,
      ),
  );
  const actionEditorCallbacksStateStore = deriveStore(
    [
      modelStateStore,
      stageIndexStateStore,
      jobIndexStateStore,
      onChangeStateStore,
    ],
    ([
      $modelStateStore,
      $stageIndexStateStore,
      $jobIndexStateStore,
      $onChangeStateStore,
    ]) =>
      orchestrationJobActionEditorCallbacks(
        $modelStateStore,
        $stageIndexStateStore,
        $jobIndexStateStore,
        $onChangeStateStore,
      ),
  );

  function setJobActionContext({
    jobIndex: nextJobIndex = 0,
    jobRow: nextJobRow = {},
    model: nextModel = {},
    onChange: nextOnChange = null,
    stageIndex: nextStageIndex = 0,
    visualDisplay: nextVisualDisplay = {},
  } = {}) {
    jobIndexStateStore.set(stageStateIntegerOr(nextJobIndex));
    jobRowStateStore.set(stageStateObjectOrEmpty(nextJobRow));
    modelStateStore.set(stageStateObjectOrEmpty(nextModel));
    onChangeStateStore.set(nextOnChange);
    stageIndexStateStore.set(stageStateIntegerOr(nextStageIndex));
    visualDisplayStateStore.set(stageStateObjectOrEmpty(nextVisualDisplay));
  }

  return {
    actionEditorCallbacksStateStore,
    actionEditorDisplayStateStore,
    jobRowStateStore,
    setJobActionContext,
  };
}

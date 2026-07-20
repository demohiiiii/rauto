import { derived as deriveStore, writable } from "svelte/store";
import { currentLanguageState } from "../../lib/i18n.js";
import { cloneJsonValue } from "../../lib/jsonValue.js";
import { listTemplateResource } from "../../api/client.js";
import {
  orchestrationCreateTxWorkflowActionModel,
  orchestrationPatchJobDraft,
} from "./orchestrationPlanFormModels.js";
import { orchestrationJsonPatchResult } from "./orchestrationTargetFormModels.js";
import { orchestrationTxWorkflowActionSettingsPanelDisplay } from "./orchestrationActionDisplayState.js";

const cloneOrchestrationJsonValue = cloneJsonValue;
const TEMPLATE_API_PATH = "/api/tx-workflow-templates";

export function orchestrationTxWorkflowFieldPatch(
  fieldKey = "",
  fieldValue = null,
) {
  if (fieldKey === "workflowTemplateName") {
    return {
      workflowTemplateName:
        fieldValue == null ? null : String(fieldValue).trim(),
      hasWorkflowTemplateName: true,
    };
  }
  if (fieldKey === "workflow") {
    return {
      workflow: cloneOrchestrationJsonValue(fieldValue, null),
      hasWorkflow: true,
    };
  }
  if (fieldKey === "workflowVars") {
    return {
      workflowVars: cloneOrchestrationJsonValue(fieldValue, {}),
      hasWorkflowVars: true,
    };
  }
  return {};
}

function orchestrationPatchTxWorkflowAction(
  model,
  stageIndex,
  jobIndex,
  patch = {},
) {
  return orchestrationPatchJobDraft(model, stageIndex, jobIndex, (job) => ({
    ...job,
    action: {
      kind: "tx_workflow",
      txWorkflow: {
        ...(job.action?.txWorkflow ||
          orchestrationCreateTxWorkflowActionModel()),
        ...patch,
      },
    },
  }));
}

export function orchestrationUpdateInlineWorkflow(
  model,
  stageIndex,
  jobIndex,
  workflow = {},
) {
  return orchestrationPatchTxWorkflowAction(model, stageIndex, jobIndex, {
    workflow: cloneOrchestrationJsonValue(workflow, {}),
    hasWorkflow: true,
    workflowTemplateName: null,
    hasWorkflowTemplateName: false,
    workflowVars: {},
    hasWorkflowVars: false,
  });
}

export function orchestrationTxWorkflowActionJsonFieldUpdateResult(
  model,
  stageIndex,
  jobIndex,
  field,
  jsonText,
) {
  return orchestrationJsonPatchResult(model, jsonText, null, (parsedJson) =>
    orchestrationPatchTxWorkflowAction(
      model,
      stageIndex,
      jobIndex,
      orchestrationTxWorkflowFieldPatch(field, parsedJson),
    ),
  );
}

function orchestrationSelectTxWorkflowActionSource(
  model,
  stageIndex,
  jobIndex,
  sourceValue,
) {
  const source =
    sourceValue === "workflow_template_name"
      ? "workflow_template_name"
      : "workflow_json";
  const patch = {
    workflow: null,
    hasWorkflow: false,
    workflowTemplateName: null,
    hasWorkflowTemplateName: false,
    workflowVars: {},
    hasWorkflowVars: false,
  };
  return orchestrationPatchTxWorkflowAction(
    model,
    stageIndex,
    jobIndex,
    source === "workflow_json"
      ? { ...patch, hasWorkflow: true }
      : { ...patch, hasWorkflowTemplateName: true },
  );
}

function orchestrationTxWorkflowActionBindings(
  model,
  stageIndex,
  jobIndex,
  onChange,
) {
  const applyChange = (nextModel) =>
    typeof onChange === "function" ? onChange(nextModel) : undefined;
  return {
    setSource(sourceValue) {
      applyChange(
        orchestrationSelectTxWorkflowActionSource(
          model,
          stageIndex,
          jobIndex,
          sourceValue,
        ),
      );
    },
    setJsonText(workflowJsonText) {
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
    setTemplateName(workflowTemplateName) {
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
    setWorkflowVars(workflowVars = {}) {
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
  model,
  stageIndex,
  jobIndex,
  onChange,
  onErrorChange,
) {
  const setFormError = (nextError = "") =>
    typeof onErrorChange === "function" ? onErrorChange(nextError) : undefined;
  const actionBindings = orchestrationTxWorkflowActionBindings(
    model,
    stageIndex,
    jobIndex,
    onChange,
  );
  return {
    setSource: actionBindings.setSource,
    setJsonText(workflowJsonText) {
      const error = actionBindings.setJsonText(workflowJsonText);
      setFormError(error);
    },
    setTemplateName: actionBindings.setTemplateName,
    setWorkflowVars(workflowVars = {}) {
      actionBindings.setWorkflowVars(workflowVars);
      setFormError("");
    },
  };
}

export function orchestrationTxWorkflowActionEditorCallbacks(
  model,
  stageIndex,
  jobIndex,
  onChange,
  onErrorChange,
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
    sourceChange(sourceValue) {
      sourceBindings.setSource(sourceValue);
    },
  };
}

function normalizeTemplateOptions(payload) {
  return [
    { label: "", value: "" },
    ...(Array.isArray(payload) ? payload : [])
      .map((item) => (typeof item === "string" ? item : item?.name))
      .filter((name) => typeof name === "string" && name.trim())
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ label: name, value: name })),
  ];
}

export function createOrchestrationTxWorkflowActionEditorWorkspace({
  apiListTemplates = listTemplateResource,
  jobIndex = 0,
  model = {},
  onChange = null,
  onErrorChange = null,
  stageIndex = 0,
} = {}) {
  const jobIndexStateStore = writable(
    Number.isInteger(jobIndex) ? jobIndex : 0,
  );
  const modelStateStore = writable(
    model && typeof model === "object" ? model : {},
  );
  const onChangeStateStore = writable(onChange);
  const onErrorChangeStateStore = writable(onErrorChange);
  const stageIndexStateStore = writable(
    Number.isInteger(stageIndex) ? stageIndex : 0,
  );
  const templateOptionsStateStore = writable([{ label: "", value: "" }]);
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

  async function refreshTemplateOptions() {
    try {
      const payload = await apiListTemplates(TEMPLATE_API_PATH);
      templateOptionsStateStore.set(normalizeTemplateOptions(payload));
      templateErrorStateStore.set("");
    } catch (error) {
      templateErrorStateStore.set(error?.message || String(error));
    }
  }

  function setTxWorkflowActionContext({
    jobIndex: nextJobIndex = 0,
    model: nextModel = {},
    onChange: nextOnChange = null,
    onErrorChange: nextOnErrorChange = null,
    stageIndex: nextStageIndex = 0,
  } = {}) {
    jobIndexStateStore.set(Number.isInteger(nextJobIndex) ? nextJobIndex : 0);
    modelStateStore.set(
      nextModel && typeof nextModel === "object" ? nextModel : {},
    );
    onChangeStateStore.set(nextOnChange);
    onErrorChangeStateStore.set(nextOnErrorChange);
    stageIndexStateStore.set(
      Number.isInteger(nextStageIndex) ? nextStageIndex : 0,
    );
  }

  return {
    actionCallbacksStateStore,
    refreshTemplateOptions,
    setTxWorkflowActionContext,
    templateErrorStateStore,
    templateOptionsStateStore,
  };
}

function txWorkflowActionObjectOrEmpty(value) {
  return value && typeof value === "object" ? value : {};
}

export function createOrchestrationTxWorkflowActionSettingsEditorWorkspace({
  txWorkflow = {},
  visualDisplay = {},
} = {}) {
  const txWorkflowStateStore = writable(
    txWorkflowActionObjectOrEmpty(txWorkflow),
  );
  const visualDisplayStateStore = writable(
    txWorkflowActionObjectOrEmpty(visualDisplay),
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
  } = {}) {
    txWorkflowStateStore.set(txWorkflowActionObjectOrEmpty(nextTxWorkflow));
    visualDisplayStateStore.set(
      txWorkflowActionObjectOrEmpty(nextVisualDisplay),
    );
  }

  return {
    settingsPanelDisplayStateStore,
    setTxWorkflowActionSettingsContext,
  };
}

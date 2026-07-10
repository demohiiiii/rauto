import { derived as deriveStore, writable } from "svelte/store";
import { currentLanguageState } from "../lib/i18n.js";
import { cloneJsonValue } from "../lib/jsonValue.js";
import {
  orchestrationCreateTxBlockActionModel,
  orchestrationCreateTxWorkflowActionModel,
  orchestrationJsonPatchResult,
  orchestrationNullableFieldModePatch,
  orchestrationExtraStringPresenceChangeHandler,
  orchestrationExtraStringValueChangeHandler,
  orchestrationPatchJobDraft,
  orchestrationToggleNullableFieldPresence,
  orchestrationToggleObjectFieldPresence,
} from "./orchestrationForms.js";
import { orchestrationTxWorkflowActionSettingsPanelDisplay } from "./orchestrationActionDisplayState.js";

const cloneOrchestrationJsonValue = cloneJsonValue;

export function orchestrationTxWorkflowFieldPatch(
  fieldKey = "",
  fieldValue = null,
) {
  if (fieldKey === "workflowFile") {
    return { workflowFile: fieldValue, hasWorkflowFile: true };
  }
  if (fieldKey === "workflowTemplateName") {
    return {
      workflowTemplateName: fieldValue,
      hasWorkflowTemplateName: true,
    };
  }
  if (fieldKey === "workflowTemplateContent") {
    return {
      workflowTemplateContent: fieldValue,
      hasWorkflowTemplateContent: true,
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

export function createOrchestrationTxWorkflowActionEditorWorkspace({
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
    setTxWorkflowActionContext,
  };
}

function orchestrationPatchTxWorkflowAction(
  model,
  stageIndex,
  jobIndex,
  patch = {},
) {
  const workflowSourceTextValue = (value) =>
    value == null ? null : String(value);
  return orchestrationPatchJobDraft(model, stageIndex, jobIndex, (job) => ({
    ...job,
    action: {
      kind: "tx_workflow",
      txBlock: job.action?.txBlock || orchestrationCreateTxBlockActionModel(),
      txWorkflow: {
        ...(job.action?.txWorkflow ||
          orchestrationCreateTxWorkflowActionModel()),
        ...patch,
        workflowFile: Object.hasOwn(patch, "workflowFile")
          ? workflowSourceTextValue(patch.workflowFile)
          : job.action?.txWorkflow?.workflowFile,
        workflowTemplateName: Object.hasOwn(patch, "workflowTemplateName")
          ? workflowSourceTextValue(patch.workflowTemplateName)
          : job.action?.txWorkflow?.workflowTemplateName,
        workflowTemplateContent: Object.hasOwn(patch, "workflowTemplateContent")
          ? workflowSourceTextValue(patch.workflowTemplateContent)
          : job.action?.txWorkflow?.workflowTemplateContent,
      },
    },
  }));
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

export function orchestrationSetTxWorkflowActionFieldPresence(
  model,
  stageIndex,
  jobIndex,
  field,
  enabled,
) {
  return orchestrationPatchTxWorkflowAction(
    model,
    stageIndex,
    jobIndex,
    orchestrationToggleNullableFieldPresence(
      model?.stages?.[stageIndex]?.jobs?.[jobIndex]?.action?.txWorkflow,
      field,
      enabled,
    ),
  );
}

export function orchestrationSetTxWorkflowActionObjectPresence(
  model,
  stageIndex,
  jobIndex,
  field,
  enabled,
) {
  return orchestrationPatchTxWorkflowAction(
    model,
    stageIndex,
    jobIndex,
    orchestrationToggleObjectFieldPresence(
      model?.stages?.[stageIndex]?.jobs?.[jobIndex]?.action?.txWorkflow,
      field,
      enabled,
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
    sourceValue === "workflow_file" ||
    sourceValue === "workflow_template_name" ||
    sourceValue === "workflow_template_content"
      ? sourceValue
      : "workflow_json";
  const patch = {
    workflowFile: null,
    hasWorkflowFile: false,
    workflow: null,
    hasWorkflow: false,
    workflowTemplateName: null,
    hasWorkflowTemplateName: false,
    workflowTemplateContent: null,
    hasWorkflowTemplateContent: false,
  };
  if (source === "workflow_json") {
    return orchestrationPatchTxWorkflowAction(model, stageIndex, jobIndex, {
      ...patch,
      hasWorkflow: true,
    });
  }
  const hasKey =
    source === "workflow_file"
      ? "hasWorkflowFile"
      : source === "workflow_template_name"
        ? "hasWorkflowTemplateName"
        : "hasWorkflowTemplateContent";
  return orchestrationPatchTxWorkflowAction(model, stageIndex, jobIndex, {
    ...patch,
    [hasKey]: true,
  });
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
    setExtra(extra) {
      applyChange(
        orchestrationPatchTxWorkflowAction(model, stageIndex, jobIndex, {
          extra,
        }),
      );
    },
    setFieldPresence(field, enabled) {
      applyChange(
        orchestrationSetTxWorkflowActionFieldPresence(
          model,
          stageIndex,
          jobIndex,
          field,
          enabled,
        ),
      );
    },
    setObjectPresence(field, enabled) {
      applyChange(
        orchestrationSetTxWorkflowActionObjectPresence(
          model,
          stageIndex,
          jobIndex,
          field,
          enabled,
        ),
      );
    },
    setWorkflowFile(workflowFile) {
      applyChange(
        orchestrationPatchTxWorkflowAction(
          model,
          stageIndex,
          jobIndex,
          orchestrationTxWorkflowFieldPatch("workflowFile", workflowFile),
        ),
      );
    },
    setWorkflowTemplateName(workflowTemplateName) {
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
    setWorkflowTemplateContent(workflowTemplateContent) {
      applyChange(
        orchestrationPatchTxWorkflowAction(
          model,
          stageIndex,
          jobIndex,
          orchestrationTxWorkflowFieldPatch(
            "workflowTemplateContent",
            workflowTemplateContent,
          ),
        ),
      );
    },
    setWorkflowVars(workflowVars) {
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
    setExtra(extra) {
      actionBindings.setExtra(extra);
    },
    setFieldPresence(field, enabled) {
      actionBindings.setFieldPresence(field, enabled);
    },
    setSource(sourceValue) {
      actionBindings.setSource(sourceValue);
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
      setFormError(result.error);
    },
    setObjectPresence(field, enabled) {
      actionBindings.setObjectPresence(field, enabled);
    },
    setTemplateContent(workflowTemplateContent) {
      actionBindings.setWorkflowTemplateContent(workflowTemplateContent);
    },
    setTemplateName(workflowTemplateName) {
      actionBindings.setWorkflowTemplateName(workflowTemplateName);
    },
    setTemplateNameMode(mode) {
      if (typeof onChange === "function") {
        onChange(
          orchestrationPatchTxWorkflowAction(
            model,
            stageIndex,
            jobIndex,
            orchestrationNullableFieldModePatch(
              model?.stages?.[stageIndex]?.jobs?.[jobIndex]?.action?.txWorkflow,
              "workflowTemplateName",
              mode,
            ),
          ),
        );
      }
    },
    setWorkflowFile(workflowFile) {
      actionBindings.setWorkflowFile(workflowFile);
    },
    setWorkflowFileMode(mode) {
      if (typeof onChange === "function") {
        onChange(
          orchestrationPatchTxWorkflowAction(
            model,
            stageIndex,
            jobIndex,
            orchestrationNullableFieldModePatch(
              model?.stages?.[stageIndex]?.jobs?.[jobIndex]?.action?.txWorkflow,
              "workflowFile",
              mode,
            ),
          ),
        );
      }
    },
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
    extraChange(extra) {
      sourceBindings.setExtra(extra);
    },
    sourceBindings,
    sourceChange(sourceValue) {
      sourceBindings.setSource(sourceValue);
    },
  };
}

export function orchestrationTxWorkflowActionSettingsCallbacks({
  onExtraChange = null,
  metadataSource = {},
} = {}) {
  return {
    metadataPresenceHandler(fieldKey) {
      return orchestrationExtraStringPresenceChangeHandler(
        onExtraChange,
        metadataSource,
        fieldKey,
      );
    },
    metadataValueHandler(fieldKey) {
      return orchestrationExtraStringValueChangeHandler(
        onExtraChange,
        metadataSource,
        fieldKey,
      );
    },
  };
}

function txWorkflowActionObjectOrEmpty(value) {
  return value && typeof value === "object" ? value : {};
}

export function createOrchestrationTxWorkflowActionSettingsEditorWorkspace({
  onExtraChange = null,
  txWorkflow = {},
  visualDisplay = {},
} = {}) {
  const onExtraChangeStateStore = writable(onExtraChange);
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
  const settingsCallbacksStateStore = deriveStore(
    [onExtraChangeStateStore, settingsPanelDisplayStateStore],
    ([$onExtraChangeStateStore, $settingsPanelDisplayStateStore]) =>
      orchestrationTxWorkflowActionSettingsCallbacks({
        onExtraChange: $onExtraChangeStateStore,
        metadataSource: $settingsPanelDisplayStateStore.extraField.source,
      }),
  );

  function setTxWorkflowActionSettingsContext({
    onExtraChange: nextOnExtraChange = null,
    txWorkflow: nextTxWorkflow = {},
    visualDisplay: nextVisualDisplay = {},
  } = {}) {
    onExtraChangeStateStore.set(nextOnExtraChange);
    txWorkflowStateStore.set(txWorkflowActionObjectOrEmpty(nextTxWorkflow));
    visualDisplayStateStore.set(
      txWorkflowActionObjectOrEmpty(nextVisualDisplay),
    );
  }

  return {
    settingsCallbacksStateStore,
    settingsPanelDisplayStateStore,
    setTxWorkflowActionSettingsContext,
  };
}

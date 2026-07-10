import { derived as deriveStore, writable } from "svelte/store";
import { currentLanguageState } from "../lib/i18n.js";
import {
  callIfFunction,
  callbackMappedFormCheckedHandler,
  callbackMappedFormValueHandler,
} from "../lib/events.js";
import {
  orchestrationTxBlockActionEditorDisplay,
  orchestrationTxBlockActionSettingsPanelDisplay,
} from "./orchestrationActionDisplayState.js";
import {
  orchestrationTxBlockActionBindings,
  orchestrationPatchTxBlockAction,
  orchestrationSetTxBlockActionFieldPresence,
  orchestrationSetTxBlockActionSource,
} from "./orchestrationTxBlockActionMutations.js";
import {
  orchestrationExtraStringPresenceChangeHandler,
  orchestrationNullableFieldModePatch,
  orchestrationPatchValueChangeHandler,
  orchestrationExtraStringValueChangeHandler,
} from "./orchestrationForms.js";

function createTxBlockScopedActionEditorWorkspace(
  createCallbacks,
  {
    jobIndex = 0,
    model = {},
    onChange = null,
    onErrorChange = null,
    stageIndex = 0,
  } = {},
) {
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
      createCallbacks(
        $modelStateStore,
        $stageIndexStateStore,
        $jobIndexStateStore,
        $onChangeStateStore,
        $onErrorChangeStateStore,
      ),
  );

  function setActionContext({
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
    setActionContext,
  };
}

export function orchestrationTxBlockExecutionCallbacks({
  onModeInput = null,
  onTimeoutInput = null,
  onResourceRollbackInput = null,
  onRollbackOnFailureChange = null,
  onRollbackTriggerInput = null,
  onSetFieldPresence = null,
} = {}) {
  return {
    presenceHandler(fieldKey) {
      return typeof onSetFieldPresence === "function"
        ? callbackMappedFormCheckedHandler(
            (enabled) => onSetFieldPresence(fieldKey, enabled),
            (enabled) => enabled,
          )
        : null;
    },
    valueHandler(fieldKey) {
      if (fieldKey === "mode") {
        return callbackMappedFormValueHandler(onModeInput, (value) => value);
      }
      if (fieldKey === "timeoutSecs") {
        return callbackMappedFormValueHandler(onTimeoutInput, (value) => value);
      }
      if (fieldKey === "resourceRollbackCommand") {
        return callbackMappedFormValueHandler(
          onResourceRollbackInput,
          (value) => value,
        );
      }
      if (fieldKey === "rollbackOnFailure") {
        return callbackMappedFormValueHandler(
          onRollbackOnFailureChange,
          (value) => value === "true",
        );
      }
      return callbackMappedFormValueHandler(
        onRollbackTriggerInput,
        (value) => value,
      );
    },
  };
}

function orchestrationTxBlockActionSettingsCallbacks({
  onSetFieldPresence = null,
  onExtraChange = null,
  extraSource = {},
} = {}) {
  return {
    namePresenceHandler:
      typeof onSetFieldPresence === "function"
        ? callbackMappedFormCheckedHandler(
            (enabled) => onSetFieldPresence("name", enabled),
            (enabled) => enabled,
          )
        : null,
    metadataPresenceHandler(fieldKey) {
      return orchestrationExtraStringPresenceChangeHandler(
        onExtraChange,
        extraSource,
        fieldKey,
      );
    },
    metadataValueHandler(fieldKey) {
      return orchestrationExtraStringValueChangeHandler(
        onExtraChange,
        extraSource,
        fieldKey,
      );
    },
  };
}

function orchestrationTxBlockActionEditorCallbacks(
  model,
  stageIndex,
  jobIndex,
  onChange,
) {
  return {
    extraChange(extra) {
      callIfFunction(
        onChange,
        orchestrationPatchTxBlockAction(model, stageIndex, jobIndex, { extra }),
      );
    },
    fieldPresenceChange(field, enabled) {
      callIfFunction(
        onChange,
        orchestrationSetTxBlockActionFieldPresence(
          model,
          stageIndex,
          jobIndex,
          field,
          enabled,
        ),
      );
    },
    nameValueChange: orchestrationPatchValueChangeHandler(onChange, (value) =>
      orchestrationPatchTxBlockAction(model, stageIndex, jobIndex, {
        name: value,
        hasName: true,
      }),
    ),
    sourceValueChange: orchestrationPatchValueChangeHandler(onChange, (value) =>
      orchestrationSetTxBlockActionSource(model, stageIndex, jobIndex, value),
    ),
  };
}

export function orchestrationTxBlockDirectActionEditorBindings(
  model,
  stageIndex,
  jobIndex,
  onChange,
  { onErrorChange = null } = {},
) {
  const bindings = orchestrationTxBlockActionBindings(
    model,
    stageIndex,
    jobIndex,
    onChange,
  );
  const clearError = () =>
    typeof onErrorChange === "function" ? onErrorChange("") : undefined;
  return {
    addListItemAction(listName) {
      return () => bindings.addListItem(listName);
    },
    fieldPresenceChange(field, enabled) {
      bindings.setFieldPresence(field, enabled);
    },
    listPresenceChange(field, enabled) {
      bindings.setListPresence(field, enabled);
    },
    listPresenceHandler(field) {
      return callbackMappedFormCheckedHandler(
        (enabled) => bindings.setListPresence(field, enabled),
        (enabled) => enabled,
      );
    },
    modeValueHandler() {
      return callbackMappedFormValueHandler(bindings.setMode, (value) => value);
    },
    setMode(mode) {
      bindings.setMode(mode);
    },
    objectPresenceChange(field, enabled) {
      bindings.setObjectPresence(field, enabled);
    },
    removeListItemAction(listName) {
      return (itemIndex) => bindings.removeListItem(listName, itemIndex);
    },
    resourceRollbackValueHandler() {
      return callbackMappedFormValueHandler(
        bindings.setResourceRollbackCommand,
        (value) => value,
      );
    },
    setResourceRollbackCommand(command) {
      bindings.setResourceRollbackCommand(command);
    },
    rollbackOnFailureCheckedHandler() {
      return callbackMappedFormCheckedHandler(
        bindings.setRollbackOnFailure,
        (enabled) => enabled,
      );
    },
    setRollbackOnFailure(rollbackOnFailure) {
      bindings.setRollbackOnFailure(rollbackOnFailure);
    },
    rollbackTriggerValueHandler() {
      return callbackMappedFormValueHandler(
        bindings.setRollbackTriggerStepIndex,
        (value) => value,
      );
    },
    setRollbackTriggerStepIndex(stepIndex) {
      bindings.setRollbackTriggerStepIndex(stepIndex);
    },
    setVars(vars = {}) {
      bindings.setVars(vars);
      clearError();
    },
    templateValueHandler() {
      return callbackMappedFormValueHandler(
        bindings.setTemplate,
        (value) => value,
      );
    },
    setTemplate(template) {
      bindings.setTemplate(template);
    },
    timeoutValueHandler() {
      return callbackMappedFormValueHandler(
        bindings.setTimeoutSecs,
        (value) => value,
      );
    },
    setTimeoutSecs(timeoutSecs) {
      bindings.setTimeoutSecs(timeoutSecs);
    },
    updateListItemAction(listName) {
      return (itemIndex, listItemText) =>
        bindings.updateListItem(listName, itemIndex, listItemText);
    },
  };
}

export function orchestrationTxBlockDirectActionEditorCallbacks(
  model,
  stageIndex,
  jobIndex,
  onChange,
  onErrorChange,
) {
  return {
    sourceBindings: orchestrationTxBlockDirectActionEditorBindings(
      model,
      stageIndex,
      jobIndex,
      onChange,
      { onErrorChange },
    ),
  };
}

export function createOrchestrationTxBlockDirectActionEditorWorkspace(
  inputState = {},
) {
  return createTxBlockScopedActionEditorWorkspace(
    orchestrationTxBlockDirectActionEditorCallbacks,
    inputState,
  );
}

export function orchestrationTxBlockFlowActionEditorBindings(
  model,
  stageIndex,
  jobIndex,
  onChange,
  { onErrorChange = null } = {},
) {
  const bindings = orchestrationTxBlockActionBindings(
    model,
    stageIndex,
    jobIndex,
    onChange,
  );
  const clearError = () =>
    typeof onErrorChange === "function" ? onErrorChange("") : undefined;
  return {
    addListItemAction(listName) {
      return () => bindings.addListItem(listName);
    },
    fieldPresenceChange(field, enabled) {
      bindings.setFieldPresence(field, enabled);
    },
    listPresenceChange(field, enabled) {
      bindings.setListPresence(field, enabled);
    },
    flowTemplateContentValueHandler() {
      return callbackMappedFormValueHandler(
        bindings.setFlowTemplateContent,
        (value) => value,
      );
    },
    flowTemplateNameValueHandler() {
      return callbackMappedFormValueHandler(
        bindings.setFlowTemplateName,
        (value) => value,
      );
    },
    listPresenceHandler(field) {
      return callbackMappedFormCheckedHandler(
        (enabled) => bindings.setListPresence(field, enabled),
        (enabled) => enabled,
      );
    },
    modeValueHandler() {
      return callbackMappedFormValueHandler(bindings.setMode, (value) => value);
    },
    setMode(mode) {
      bindings.setMode(mode);
    },
    objectPresenceChange(field, enabled) {
      bindings.setObjectPresence(field, enabled);
    },
    removeListItemAction(listName) {
      return (itemIndex) => bindings.removeListItem(listName, itemIndex);
    },
    resourceRollbackValueHandler() {
      return callbackMappedFormValueHandler(
        bindings.setResourceRollbackCommand,
        (value) => value,
      );
    },
    setResourceRollbackCommand(command) {
      bindings.setResourceRollbackCommand(command);
    },
    rollbackOnFailureCheckedHandler() {
      return callbackMappedFormCheckedHandler(
        bindings.setRollbackOnFailure,
        (enabled) => enabled,
      );
    },
    setRollbackOnFailure(rollbackOnFailure) {
      bindings.setRollbackOnFailure(rollbackOnFailure);
    },
    rollbackTriggerValueHandler() {
      return callbackMappedFormValueHandler(
        bindings.setRollbackTriggerStepIndex,
        (value) => value,
      );
    },
    setRollbackTriggerStepIndex(stepIndex) {
      bindings.setRollbackTriggerStepIndex(stepIndex);
    },
    setFlowVars(flowVars = {}) {
      bindings.setFlowVars(flowVars);
      clearError();
    },
    setFlowTemplateContent(templateContent) {
      bindings.setFlowTemplateContent(templateContent);
    },
    setFlowTemplateName(templateName) {
      bindings.setFlowTemplateName(templateName);
    },
    setFlowTemplateNameMode(mode) {
      if (typeof onChange === "function") {
        onChange(
          orchestrationPatchTxBlockAction(
            model,
            stageIndex,
            jobIndex,
            orchestrationNullableFieldModePatch(
              model?.stages?.[stageIndex]?.jobs?.[jobIndex]?.action?.txBlock,
              "flowTemplateName",
              mode,
            ),
          ),
        );
      }
    },
    timeoutValueHandler() {
      return callbackMappedFormValueHandler(
        bindings.setTimeoutSecs,
        (value) => value,
      );
    },
    setTimeoutSecs(timeoutSecs) {
      bindings.setTimeoutSecs(timeoutSecs);
    },
    updateListItemAction(listName) {
      return (itemIndex, listItemText) =>
        bindings.updateListItem(listName, itemIndex, listItemText);
    },
  };
}

export function orchestrationTxBlockFlowActionEditorCallbacks(
  model,
  stageIndex,
  jobIndex,
  onChange,
  onErrorChange,
) {
  return {
    sourceBindings: orchestrationTxBlockFlowActionEditorBindings(
      model,
      stageIndex,
      jobIndex,
      onChange,
      { onErrorChange },
    ),
  };
}

export function createOrchestrationTxBlockFlowActionEditorWorkspace(
  inputState = {},
) {
  return createTxBlockScopedActionEditorWorkspace(
    orchestrationTxBlockFlowActionEditorCallbacks,
    inputState,
  );
}

export function orchestrationTxBlockTemplateSourceBindings(
  model,
  stageIndex,
  jobIndex,
  onChange,
  onErrorChange,
) {
  const clearError = () =>
    typeof onErrorChange === "function" ? onErrorChange("") : undefined;
  const actionBindings = orchestrationTxBlockActionBindings(
    model,
    stageIndex,
    jobIndex,
    onChange,
  );
  return {
    setFieldPresence(field, enabled) {
      actionBindings.setFieldPresence(field, enabled);
    },
    setObjectPresence(field, enabled) {
      actionBindings.setObjectPresence(field, enabled);
    },
    setTemplateContent(templateContent) {
      actionBindings.setTxBlockTemplateContent(templateContent);
    },
    setTemplateName(templateName) {
      actionBindings.setTxBlockTemplateName(templateName);
    },
    setTemplateNameMode(mode) {
      if (typeof onChange === "function") {
        onChange(
          orchestrationPatchTxBlockAction(
            model,
            stageIndex,
            jobIndex,
            orchestrationNullableFieldModePatch(
              model?.stages?.[stageIndex]?.jobs?.[jobIndex]?.action?.txBlock,
              "txBlockTemplateName",
              mode,
            ),
          ),
        );
      }
    },
    setTemplateVars(txBlockTemplateVars = {}) {
      actionBindings.setTxBlockTemplateVars(txBlockTemplateVars);
      clearError();
    },
  };
}

export function orchestrationTxBlockTemplateActionEditorCallbacks(
  model,
  stageIndex,
  jobIndex,
  onChange,
  onErrorChange,
) {
  return {
    sourceBindings: orchestrationTxBlockTemplateSourceBindings(
      model,
      stageIndex,
      jobIndex,
      onChange,
      onErrorChange,
    ),
  };
}

export function createOrchestrationTxBlockTemplateActionEditorWorkspace(
  inputState = {},
) {
  return createTxBlockScopedActionEditorWorkspace(
    orchestrationTxBlockTemplateActionEditorCallbacks,
    inputState,
  );
}

function txBlockActionObjectOrEmpty(value) {
  return value && typeof value === "object" ? value : {};
}

function txBlockActionIntegerOr(value, fallback = 0) {
  return Number.isInteger(value) ? value : fallback;
}

export function createOrchestrationTxBlockActionEditorWorkspace({
  jobIndex = 0,
  jobRow = {},
  model = {},
  onChange = null,
  stageIndex = 0,
} = {}) {
  const jobIndexStateStore = writable(txBlockActionIntegerOr(jobIndex));
  const jobRowStateStore = writable(txBlockActionObjectOrEmpty(jobRow));
  const modelStateStore = writable(txBlockActionObjectOrEmpty(model));
  const onChangeStateStore = writable(onChange);
  const stageIndexStateStore = writable(txBlockActionIntegerOr(stageIndex));
  const txBlockActionDisplayStateStore = deriveStore(
    [jobRowStateStore, currentLanguageState],
    ([$jobRowStateStore]) =>
      orchestrationTxBlockActionEditorDisplay($jobRowStateStore.txBlockRows),
  );
  const actionCallbacksStateStore = deriveStore(
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
      orchestrationTxBlockActionEditorCallbacks(
        $modelStateStore,
        $stageIndexStateStore,
        $jobIndexStateStore,
        $onChangeStateStore,
      ),
  );

  function setTxBlockActionContext({
    jobIndex: nextJobIndex = 0,
    jobRow: nextJobRow = {},
    model: nextModel = {},
    onChange: nextOnChange = null,
    stageIndex: nextStageIndex = 0,
  } = {}) {
    jobIndexStateStore.set(txBlockActionIntegerOr(nextJobIndex));
    jobRowStateStore.set(txBlockActionObjectOrEmpty(nextJobRow));
    modelStateStore.set(txBlockActionObjectOrEmpty(nextModel));
    onChangeStateStore.set(nextOnChange);
    stageIndexStateStore.set(txBlockActionIntegerOr(nextStageIndex));
  }

  return {
    actionCallbacksStateStore,
    jobRowStateStore,
    setTxBlockActionContext,
    txBlockActionDisplayStateStore,
  };
}

export function createOrchestrationTxBlockActionSettingsEditorWorkspace({
  onExtraChange = null,
  onSetFieldPresence = null,
  txBlock = {},
  visualDisplay = {},
} = {}) {
  const onExtraChangeStateStore = writable(onExtraChange);
  const onSetFieldPresenceStateStore = writable(onSetFieldPresence);
  const txBlockStateStore = writable(txBlockActionObjectOrEmpty(txBlock));
  const visualDisplayStateStore = writable(
    txBlockActionObjectOrEmpty(visualDisplay),
  );
  const settingsPanelDisplayStateStore = deriveStore(
    [txBlockStateStore, visualDisplayStateStore, currentLanguageState],
    ([$txBlockStateStore, $visualDisplayStateStore]) =>
      orchestrationTxBlockActionSettingsPanelDisplay(
        $txBlockStateStore,
        $visualDisplayStateStore,
      ),
  );
  const settingsCallbacksStateStore = deriveStore(
    [
      onSetFieldPresenceStateStore,
      onExtraChangeStateStore,
      settingsPanelDisplayStateStore,
    ],
    ([
      $onSetFieldPresenceStateStore,
      $onExtraChangeStateStore,
      $settingsPanelDisplayStateStore,
    ]) =>
      orchestrationTxBlockActionSettingsCallbacks({
        onSetFieldPresence: $onSetFieldPresenceStateStore,
        onExtraChange: $onExtraChangeStateStore,
        extraSource: $settingsPanelDisplayStateStore.extraField.source,
      }),
  );

  function setTxBlockActionSettingsContext({
    onExtraChange: nextOnExtraChange = null,
    onSetFieldPresence: nextOnSetFieldPresence = null,
    txBlock: nextTxBlock = {},
    visualDisplay: nextVisualDisplay = {},
  } = {}) {
    onExtraChangeStateStore.set(nextOnExtraChange);
    onSetFieldPresenceStateStore.set(nextOnSetFieldPresence);
    txBlockStateStore.set(txBlockActionObjectOrEmpty(nextTxBlock));
    visualDisplayStateStore.set(txBlockActionObjectOrEmpty(nextVisualDisplay));
  }

  return {
    settingsCallbacksStateStore,
    settingsPanelDisplayStateStore,
    setTxBlockActionSettingsContext,
  };
}

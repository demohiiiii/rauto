import { derived as deriveStore, writable } from "svelte/store";
import { callIfFunction, formChecked, formValue } from "../lib/events.js";
import { currentLanguageState } from "../lib/i18n.js";
import {
  txSetExtraStringFieldPresence,
  txSetExtraStringFieldValue,
} from "./transactionMetadataFields.js";
import { orchestrationTargetInputDisplay } from "./orchestrationFormDisplayState.js";

function orchestrationInputValue(value, fallback = "") {
  return value && typeof value === "object" && "currentTarget" in value
    ? formValue(value, fallback)
    : (value ?? fallback);
}

function orchestrationInputChecked(value) {
  return value && typeof value === "object" && "currentTarget" in value
    ? formChecked(value)
    : !!value;
}

export function orchestrationExtraStringValueChangeHandler(
  callback,
  extraSource,
  fieldKey,
  wrapResult = (extra) => extra,
) {
  return (value) =>
    callIfFunction(
      callback,
      wrapResult(
        txSetExtraStringFieldValue(
          typeof extraSource === "function" ? extraSource() : extraSource,
          fieldKey,
          orchestrationInputValue(value),
        ),
      ),
    );
}

export function orchestrationExtraStringPresenceChangeHandler(
  callback,
  extraSource,
  fieldKey,
  wrapResult = (extra) => extra,
) {
  return (enabled) =>
    callIfFunction(
      callback,
      wrapResult(
        txSetExtraStringFieldPresence(
          typeof extraSource === "function" ? extraSource() : extraSource,
          fieldKey,
          orchestrationInputChecked(enabled),
        ),
      ),
    );
}

export function orchestrationPatchValueChangeHandler(
  callback,
  patchFactory = (value) => value,
) {
  return (value) =>
    callIfFunction(callback, patchFactory(orchestrationInputValue(value)));
}

export function orchestrationPatchPresenceChangeHandler(
  callback,
  patchFactory = (enabled) => enabled,
) {
  return (enabled) =>
    callIfFunction(callback, patchFactory(orchestrationInputChecked(enabled)));
}
export {
  orchestrationCloneFormModel,
  orchestrationCreateJobModel,
  orchestrationCreateStageModel,
  orchestrationCreateTxBlockActionModel,
  orchestrationCreateTxWorkflowActionModel,
  orchestrationPatchJobDraft,
  orchestrationPlanFormModelFromJson,
  orchestrationPlanFormModelFromJsonText,
  orchestrationPlanFormModelToJsonText,
} from "./orchestrationPlanFormModels.js";

export {
  orchestrationConnectionTextValue,
  orchestrationCreateTargetInputModel,
  orchestrationDefaultTargetModel,
  orchestrationInventoryGroupModelFromJson,
  orchestrationInventoryModelFromJson,
  orchestrationJsonFieldValue,
  orchestrationJsonObjectPatchResult,
  orchestrationJsonPatchResult,
  orchestrationNormalizeConnectionPatch,
  orchestrationNullableFieldModePatch,
  orchestrationNullableTextValue,
  orchestrationObjectExtra,
  orchestrationTargetDefaultsModelFromJson,
  orchestrationTargetInputModelFromJson,
  orchestrationTargetModelFromJson,
  orchestrationToggleNullableFieldPresence,
  orchestrationToggleObjectFieldPresence,
  orchestrationToggleTargetFieldPresence,
} from "./orchestrationTargetFormModels.js";

function orchestrationTargetInputEditorBindings({
  onConnectionChange = null,
  onExtraChange = null,
  onFieldChange = null,
  onFieldNullableModeChange = null,
  onFieldPresenceChange = null,
  onKindChange = null,
  onVarsChange = null,
  onVarsPresenceChange = null,
  target = null,
} = {}) {
  const extraSource = () => {
    if (target && typeof target === "object") {
      if (target.target && typeof target.target === "object") {
        return target.target.extra || {};
      }
      return target.extra || {};
    }
    return {};
  };

  return {
    connectionChangeHandler() {
      return (value) =>
        callIfFunction(onConnectionChange, orchestrationInputValue(value));
    },
    extraChange(extra) {
      return callIfFunction(onExtraChange, extra);
    },
    extraPresenceHandler(fieldKey = "") {
      return orchestrationExtraStringPresenceChangeHandler(
        onExtraChange,
        extraSource,
        fieldKey,
      );
    },
    extraValueHandler(fieldKey = "") {
      return orchestrationExtraStringValueChangeHandler(
        onExtraChange,
        extraSource,
        fieldKey,
      );
    },
    fieldPresenceHandler(fieldName = "") {
      return typeof onFieldPresenceChange === "function"
        ? (enabled) =>
            onFieldPresenceChange(fieldName, orchestrationInputChecked(enabled))
        : null;
    },
    fieldNullableModeHandler(fieldName = "") {
      return typeof onFieldNullableModeChange === "function"
        ? (mode) =>
            onFieldNullableModeChange(fieldName, orchestrationInputValue(mode))
        : null;
    },
    fieldValueHandler(fieldName = "") {
      return (fieldValue) =>
        callIfFunction(
          onFieldChange,
          fieldName,
          orchestrationInputValue(fieldValue),
        );
    },
    kindChangeHandler() {
      return (value) =>
        callIfFunction(onKindChange, orchestrationInputValue(value));
    },
    varsChange(vars) {
      return callIfFunction(onVarsChange, vars);
    },
    varsPresenceHandler() {
      return typeof onVarsPresenceChange === "function"
        ? (enabled) => onVarsPresenceChange(orchestrationInputChecked(enabled))
        : null;
    },
  };
}

function orchestrationTargetInputActionHandlers(options = {}) {
  return orchestrationTargetInputEditorBindings(options);
}

export function createOrchestrationTargetInputEditorWorkspace({
  titleText = "",
  target = null,
  connectionOptionRows = [],
  targetDetail = null,
  targetFieldRows = [],
  varsText = "",
  targetInputKindRows = [],
  jsonValueTypeRows = [],
  onKindChange = null,
  onConnectionChange = null,
  onFieldChange = null,
  onFieldNullableModeChange = null,
  onFieldPresenceChange = null,
  onVarsChange = null,
  onVarsPresenceChange = null,
  onExtraChange = null,
} = {}) {
  const displayInputsStateStore = writable({
    titleText,
    target,
    connectionOptionRows,
    targetDetail,
    targetFieldRows,
    varsText,
    targetInputKindRows,
    jsonValueTypeRows,
    onFieldPresenceChange,
    onVarsPresenceChange,
  });
  const callbackInputsStateStore = writable({
    onKindChange,
    onConnectionChange,
    onFieldChange,
    onFieldNullableModeChange,
    onFieldPresenceChange,
    onVarsChange,
    onVarsPresenceChange,
    onExtraChange,
    target,
  });
  const targetInputDisplayStateStore = deriveStore(
    [displayInputsStateStore, currentLanguageState],
    ([$displayInputsStateStore]) =>
      orchestrationTargetInputDisplay(
        {
          target: $displayInputsStateStore.target,
          targetConnectionOptionRows:
            $displayInputsStateStore.connectionOptionRows,
          targetDetail: $displayInputsStateStore.targetDetail,
          targetFieldRows: $displayInputsStateStore.targetFieldRows,
          varsText: $displayInputsStateStore.varsText,
        },
        {
          titleText: $displayInputsStateStore.titleText,
          targetInputKindRows: $displayInputsStateStore.targetInputKindRows,
          jsonValueTypeRows: $displayInputsStateStore.jsonValueTypeRows,
          showFieldPresenceToggle:
            !!$displayInputsStateStore.onFieldPresenceChange,
          showVarsPresenceToggle:
            !!$displayInputsStateStore.onVarsPresenceChange,
        },
      ),
  );
  const targetInputActionHandlersStateStore = deriveStore(
    callbackInputsStateStore,
    ($callbackInputsStateStore) =>
      orchestrationTargetInputActionHandlers($callbackInputsStateStore),
  );
  return {
    setTargetInputContext({
      titleText: nextTitleText = "",
      target: nextTarget = null,
      connectionOptionRows: nextConnectionOptionRows = [],
      targetDetail: nextTargetDetail = null,
      targetFieldRows: nextTargetFieldRows = [],
      varsText: nextVarsText = "",
      targetInputKindRows: nextTargetInputKindRows = [],
      jsonValueTypeRows: nextJsonValueTypeRows = [],
      onKindChange: nextOnKindChange = null,
      onConnectionChange: nextOnConnectionChange = null,
      onFieldChange: nextOnFieldChange = null,
      onFieldNullableModeChange: nextOnFieldNullableModeChange = null,
      onFieldPresenceChange: nextOnFieldPresenceChange = null,
      onVarsChange: nextOnVarsChange = null,
      onVarsPresenceChange: nextOnVarsPresenceChange = null,
      onExtraChange: nextOnExtraChange = null,
    } = {}) {
      displayInputsStateStore.set({
        titleText: nextTitleText,
        target: nextTarget,
        connectionOptionRows: nextConnectionOptionRows,
        targetDetail: nextTargetDetail,
        targetFieldRows: nextTargetFieldRows,
        varsText: nextVarsText,
        targetInputKindRows: nextTargetInputKindRows,
        jsonValueTypeRows: nextJsonValueTypeRows,
        onFieldPresenceChange: nextOnFieldPresenceChange,
        onVarsPresenceChange: nextOnVarsPresenceChange,
      });
      callbackInputsStateStore.set({
        onKindChange: nextOnKindChange,
        onConnectionChange: nextOnConnectionChange,
        onFieldChange: nextOnFieldChange,
        onFieldNullableModeChange: nextOnFieldNullableModeChange,
        onFieldPresenceChange: nextOnFieldPresenceChange,
        onVarsChange: nextOnVarsChange,
        onVarsPresenceChange: nextOnVarsPresenceChange,
        onExtraChange: nextOnExtraChange,
        target: nextTarget,
      });
    },
    targetInputActionHandlersStateStore,
    targetInputDisplayStateStore,
  };
}

export {
  orchestrationPatchInventory,
  orchestrationPatchInventoryDefaults,
  orchestrationSetInventoryDefaultsFieldPresence,
  orchestrationSetInventoryDefaultsVarsPresence,
  orchestrationInventoryDefaultsBindings,
} from "./orchestrationInventoryDefaultsState.js";

export {
  orchestrationAddInventoryGroup,
  orchestrationRemoveInventoryGroup,
  orchestrationPatchInventoryGroup,
  orchestrationPatchInventoryGroupDefaults,
  orchestrationSetInventoryGroupDefaultsFieldPresence,
  orchestrationSetInventoryGroupDefaultsVarsPresence,
  orchestrationInventoryGroupSettingsBindings,
  orchestrationSetInventoryEnabled,
} from "./orchestrationInventoryGroupsState.js";

export {
  orchestrationSetInventoryGroupTargetsPresence,
  orchestrationPatchInventoryGroupTargetsText,
  orchestrationAddInventoryGroupSimpleTarget,
  orchestrationUpdateInventoryGroupSimpleTarget,
  orchestrationRemoveInventoryGroupSimpleTarget,
  orchestrationAddInventoryGroupTarget,
  orchestrationRemoveInventoryGroupTarget,
  orchestrationPatchInventoryGroupTargetInput,
  orchestrationSetInventoryGroupTargetFieldPresence,
  orchestrationSetInventoryGroupTargetVarsPresence,
} from "./orchestrationInventoryTargets.js";

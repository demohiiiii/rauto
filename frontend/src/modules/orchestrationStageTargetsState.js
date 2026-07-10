import { derived as deriveStore, writable } from "svelte/store";
import { callbackHandler } from "../lib/events.js";
import { currentLanguageState, t } from "../lib/i18n.js";
import {
  orchestrationDefaultTargetModel,
  orchestrationNullableFieldModePatch,
} from "./orchestrationForms.js";
import { orchestrationJobTargetsDisplay } from "./orchestrationFormDisplayState.js";
import {
  orchestrationAddJobStringListItem,
  orchestrationAddTarget,
  orchestrationPatchTargetInput,
  orchestrationRemoveJobStringListItem,
  orchestrationRemoveTarget,
  orchestrationSetJobListPresence,
  orchestrationSetJobTargetFieldPresence,
  orchestrationSetJobTargetVarsPresence,
  orchestrationUpdateJobStringListItem,
} from "./orchestrationStageMutations.js";

export {
  orchestrationPatchTargetInput,
  orchestrationSetJobListPresence,
  orchestrationSetJobTargetFieldPresence,
  orchestrationSetJobTargetVarsPresence,
} from "./orchestrationStageMutations.js";

function stageStateObjectOrEmpty(value) {
  return value && typeof value === "object" ? value : {};
}

function stageStateIntegerOr(value, fallback = 0) {
  return Number.isInteger(value) ? value : fallback;
}

function orchestrationJobTargetsEditorBindings({
  onAddStringListItem = null,
  onAddTarget = null,
  onRemoveStringListItem = null,
  onRemoveTarget = null,
  onSetListPresence = null,
  onTargetConnectionChange = null,
  onTargetExtraChange = null,
  onTargetFieldChange = null,
  onTargetFieldNullableModeChange = null,
  onTargetFieldPresenceChange = null,
  onTargetKindChange = null,
  onTargetVarsChange = null,
  onTargetVarsPresenceChange = null,
  onUpdateStringListItem = null,
} = {}) {
  return {
    addStringListItemHandler(listName = "") {
      return callbackHandler(onAddStringListItem, listName);
    },
    addTargetHandler: callbackHandler(onAddTarget),
    listPresenceHandler(listName = "") {
      return (enabled) =>
        typeof onSetListPresence === "function"
          ? onSetListPresence(listName, enabled)
          : undefined;
    },
    removeStringListItemHandler(listName = "") {
      return callbackHandler(onRemoveStringListItem, listName);
    },
    removeTargetHandler(targetIndex = -1) {
      return callbackHandler(onRemoveTarget, targetIndex);
    },
    targetConnectionHandler(targetIndex = -1) {
      return callbackHandler(onTargetConnectionChange, targetIndex);
    },
    targetExtraHandler(targetIndex = -1) {
      return callbackHandler(onTargetExtraChange, targetIndex);
    },
    targetFieldHandler(targetIndex = -1) {
      return callbackHandler(onTargetFieldChange, targetIndex);
    },
    targetFieldNullableModeHandler(targetIndex = -1) {
      return callbackHandler(onTargetFieldNullableModeChange, targetIndex);
    },
    targetFieldPresenceHandler(targetIndex = -1) {
      return callbackHandler(onTargetFieldPresenceChange, targetIndex);
    },
    targetKindHandler(targetIndex = -1) {
      return callbackHandler(onTargetKindChange, targetIndex);
    },
    targetVarsHandler(targetIndex = -1) {
      return callbackHandler(onTargetVarsChange, targetIndex);
    },
    targetVarsPresenceHandler(targetIndex = -1) {
      return callbackHandler(onTargetVarsPresenceChange, targetIndex);
    },
    updateStringListItemHandler(listName = "") {
      return callbackHandler(onUpdateStringListItem, listName);
    },
  };
}

function orchestrationJobTargetsActionHandlers(options = {}) {
  return orchestrationJobTargetsEditorBindings(options);
}

function orchestrationJobTargetsSectionCallbacks(
  model,
  stageIndex,
  jobIndex,
  onChange,
) {
  const applyChange = (nextModel) =>
    typeof onChange === "function" ? onChange(nextModel) : undefined;
  return {
    addStringListItem(listName) {
      applyChange(
        orchestrationAddJobStringListItem(
          model,
          stageIndex,
          jobIndex,
          listName,
        ),
      );
    },
    addTarget() {
      applyChange(orchestrationAddTarget(model, stageIndex, jobIndex));
    },
    changeTargetConnection(targetIndex, connectionName) {
      applyChange(
        orchestrationPatchTargetInput(
          model,
          stageIndex,
          jobIndex,
          targetIndex,
          { connection: connectionName },
        ),
      );
    },
    changeTargetExtra(targetIndex, extra) {
      applyChange(
        orchestrationPatchTargetInput(
          model,
          stageIndex,
          jobIndex,
          targetIndex,
          {
            kind: "detailed",
            target: { extra },
          },
        ),
      );
    },
    changeTargetField(targetIndex, fieldName, fieldValue) {
      applyChange(
        orchestrationPatchTargetInput(
          model,
          stageIndex,
          jobIndex,
          targetIndex,
          {
            kind: "detailed",
            target: { [fieldName]: fieldValue },
          },
        ),
      );
    },
    changeTargetFieldMode(targetIndex, fieldName, mode) {
      applyChange(
        orchestrationPatchTargetInput(
          model,
          stageIndex,
          jobIndex,
          targetIndex,
          {
            kind: "detailed",
            target: orchestrationNullableFieldModePatch(
              model?.stages?.[stageIndex]?.jobs?.[jobIndex]?.targets?.[
                targetIndex
              ]?.target || orchestrationDefaultTargetModel(),
              fieldName,
              mode,
            ),
          },
        ),
      );
    },
    changeTargetKind(targetIndex, targetKind) {
      applyChange(
        orchestrationPatchTargetInput(
          model,
          stageIndex,
          jobIndex,
          targetIndex,
          { kind: targetKind },
        ),
      );
    },
    changeTargetVars(targetIndex, vars) {
      applyChange(
        orchestrationPatchTargetInput(
          model,
          stageIndex,
          jobIndex,
          targetIndex,
          {
            kind: "detailed",
            target: { vars },
          },
        ),
      );
    },
    removeStringListItem(listName, itemIndex) {
      applyChange(
        orchestrationRemoveJobStringListItem(
          model,
          stageIndex,
          jobIndex,
          listName,
          itemIndex,
        ),
      );
    },
    removeTarget(targetIndex) {
      applyChange(
        orchestrationRemoveTarget(model, stageIndex, jobIndex, targetIndex),
      );
    },
    setListPresence(listName, enabled) {
      applyChange(
        orchestrationSetJobListPresence(
          model,
          stageIndex,
          jobIndex,
          listName,
          enabled,
        ),
      );
    },
    setTargetFieldPresence(targetIndex, fieldName, enabled) {
      applyChange(
        orchestrationSetJobTargetFieldPresence(
          model,
          stageIndex,
          jobIndex,
          targetIndex,
          fieldName,
          enabled,
        ),
      );
    },
    setTargetVarsPresence(targetIndex, enabled) {
      applyChange(
        orchestrationSetJobTargetVarsPresence(
          model,
          stageIndex,
          jobIndex,
          targetIndex,
          enabled,
        ),
      );
    },
    updateStringListItem(listName, itemIndex, nextValue) {
      applyChange(
        orchestrationUpdateJobStringListItem(
          model,
          stageIndex,
          jobIndex,
          listName,
          itemIndex,
          nextValue,
        ),
      );
    },
  };
}

export function createOrchestrationJobTargetsEditorWorkspace({
  jobRow = {},
  onAddStringListItem = null,
  onAddTarget = null,
  onRemoveStringListItem = null,
  onRemoveTarget = null,
  onSetListPresence = null,
  onTargetConnectionChange = null,
  onTargetExtraChange = null,
  onTargetFieldChange = null,
  onTargetFieldNullableModeChange = null,
  onTargetFieldPresenceChange = null,
  onTargetKindChange = null,
  onTargetVarsChange = null,
  onTargetVarsPresenceChange = null,
  onUpdateStringListItem = null,
} = {}) {
  const jobRowStateStore = writable(jobRow);
  const callbackInputsStateStore = writable({
    onAddStringListItem,
    onAddTarget,
    onRemoveStringListItem,
    onRemoveTarget,
    onSetListPresence,
    onTargetConnectionChange,
    onTargetExtraChange,
    onTargetFieldChange,
    onTargetFieldNullableModeChange,
    onTargetFieldPresenceChange,
    onTargetKindChange,
    onTargetVarsChange,
    onTargetVarsPresenceChange,
    onUpdateStringListItem,
  });
  const jobTargetsDisplayStateStore = deriveStore(
    [jobRowStateStore, currentLanguageState],
    ([$jobRowStateStore]) =>
      orchestrationJobTargetsDisplay($jobRowStateStore, {
        addTargetLabelText: t("orchestrationFormAddTarget"),
        addValueLabelText: t("txBlockFormAddVar"),
        deleteLabelText: t("deleteBtn"),
        targetGroupLabelText: t("orchestrationFormTargetGroups"),
        targetTagLabelText: t("orchestrationFormTargetTags"),
        targetLabelText: t("orchestrationFormTarget"),
      }),
  );
  const targetActionHandlersStateStore = deriveStore(
    callbackInputsStateStore,
    ($callbackInputsStateStore) =>
      orchestrationJobTargetsActionHandlers($callbackInputsStateStore),
  );
  return {
    jobTargetsDisplayStateStore,
    setJobTargetsContext({
      jobRow: nextJobRow = {},
      onAddStringListItem: nextOnAddStringListItem = null,
      onAddTarget: nextOnAddTarget = null,
      onRemoveStringListItem: nextOnRemoveStringListItem = null,
      onRemoveTarget: nextOnRemoveTarget = null,
      onSetListPresence: nextOnSetListPresence = null,
      onTargetConnectionChange: nextOnTargetConnectionChange = null,
      onTargetExtraChange: nextOnTargetExtraChange = null,
      onTargetFieldChange: nextOnTargetFieldChange = null,
      onTargetFieldNullableModeChange:
        nextOnTargetFieldNullableModeChange = null,
      onTargetFieldPresenceChange: nextOnTargetFieldPresenceChange = null,
      onTargetKindChange: nextOnTargetKindChange = null,
      onTargetVarsChange: nextOnTargetVarsChange = null,
      onTargetVarsPresenceChange: nextOnTargetVarsPresenceChange = null,
      onUpdateStringListItem: nextOnUpdateStringListItem = null,
    } = {}) {
      jobRowStateStore.set(nextJobRow);
      callbackInputsStateStore.set({
        onAddStringListItem: nextOnAddStringListItem,
        onAddTarget: nextOnAddTarget,
        onRemoveStringListItem: nextOnRemoveStringListItem,
        onRemoveTarget: nextOnRemoveTarget,
        onSetListPresence: nextOnSetListPresence,
        onTargetConnectionChange: nextOnTargetConnectionChange,
        onTargetExtraChange: nextOnTargetExtraChange,
        onTargetFieldChange: nextOnTargetFieldChange,
        onTargetFieldNullableModeChange: nextOnTargetFieldNullableModeChange,
        onTargetFieldPresenceChange: nextOnTargetFieldPresenceChange,
        onTargetKindChange: nextOnTargetKindChange,
        onTargetVarsChange: nextOnTargetVarsChange,
        onTargetVarsPresenceChange: nextOnTargetVarsPresenceChange,
        onUpdateStringListItem: nextOnUpdateStringListItem,
      });
    },
    targetActionHandlersStateStore,
  };
}

export function createOrchestrationJobTargetsSectionWorkspace() {
  const callbackInputsStateStore = writable({
    jobIndex: 0,
    model: {},
    onChange: null,
    stageIndex: 0,
  });
  const sectionCallbacksStateStore = deriveStore(
    callbackInputsStateStore,
    ($callbackInputsStateStore) =>
      orchestrationJobTargetsSectionCallbacks(
        $callbackInputsStateStore.model,
        $callbackInputsStateStore.stageIndex,
        $callbackInputsStateStore.jobIndex,
        $callbackInputsStateStore.onChange,
      ),
  );
  return {
    sectionCallbacksStateStore,
    setJobTargetsSectionContext({
      jobIndex: nextJobIndex = 0,
      model: nextModel = {},
      onChange: nextOnChange = null,
      stageIndex: nextStageIndex = 0,
    } = {}) {
      callbackInputsStateStore.set({
        jobIndex: stageStateIntegerOr(nextJobIndex),
        model: stageStateObjectOrEmpty(nextModel),
        onChange: nextOnChange,
        stageIndex: stageStateIntegerOr(nextStageIndex),
      });
    },
  };
}

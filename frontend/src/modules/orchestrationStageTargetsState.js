import { derived as deriveStore, writable } from "svelte/store";
import { callbackHandler } from "../lib/events.js";
import { currentLanguageState, t } from "../lib/i18n.js";
import { orchestrationJobTargetsDisplay } from "./orchestrationFormDisplayState.js";
import { orchestrationReplaceJobStringList } from "./orchestrationStageMutations.js";

function stateObjectOrEmpty(value) {
  return value && typeof value === "object" ? value : {};
}

function integerOr(value, fallback = 0) {
  return Number.isInteger(value) ? value : fallback;
}

function orchestrationJobTargetsActionHandlers({
  onReplaceStringList = null,
} = {}) {
  return {
    replaceStringListHandler(listName = "") {
      return callbackHandler(onReplaceStringList, listName);
    },
  };
}

function orchestrationJobTargetsSectionCallbacks(
  model,
  stageIndex,
  jobIndex,
  onChange,
) {
  return {
    replaceStringList(listName, values) {
      if (typeof onChange !== "function") return;
      onChange(
        orchestrationReplaceJobStringList(
          model,
          stageIndex,
          jobIndex,
          listName,
          values,
        ),
      );
    },
  };
}

export function createOrchestrationJobTargetsEditorWorkspace({
  jobRow = {},
  onReplaceStringList = null,
} = {}) {
  const jobRowStateStore = writable(jobRow);
  const callbackInputsStateStore = writable({ onReplaceStringList });
  const jobTargetsDisplayStateStore = deriveStore(
    [jobRowStateStore, currentLanguageState],
    ([$jobRowStateStore]) =>
      orchestrationJobTargetsDisplay($jobRowStateStore, {
        targetGroupLabelText: t("orchestrationFormTargetGroups"),
        targetTagLabelText: t("orchestrationFormTargetTags"),
        targetLabelText: t("orchestrationFormSavedConnections"),
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
      onReplaceStringList: nextOnReplaceStringList = null,
    } = {}) {
      jobRowStateStore.set(nextJobRow);
      callbackInputsStateStore.set({
        onReplaceStringList: nextOnReplaceStringList,
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
        jobIndex: integerOr(nextJobIndex),
        model: stateObjectOrEmpty(nextModel),
        onChange: nextOnChange,
        stageIndex: integerOr(nextStageIndex),
      });
    },
  };
}

import { derived as deriveStore, writable } from "svelte/store";
import { callbackHandler } from "../../../lib/events.js";
import { currentLanguageState, t } from "../../../lib/i18n.js";
import { orchestrationReplaceJobStringList } from "../model/orchestrationStageMutations.js";
import { orchestrationJobTargetsDisplay } from "../presentation/orchestrationFormStructureState.js";
import type { JsonObject, OrchestrationPlanFormModel } from "../model/types.js";

type PlanChangeHandler = (model: OrchestrationPlanFormModel) => unknown;
type ReplaceStringListHandler = (listName: string, values: unknown) => unknown;

interface JobTargetsEditorContext {
  jobRow?: unknown;
  onReplaceStringList?: ReplaceStringListHandler | null;
}

interface JobTargetsSectionContext {
  jobIndex?: unknown;
  model?: unknown;
  onChange?: PlanChangeHandler | null;
  stageIndex?: unknown;
}

function stateObjectOrEmpty(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function planModelValue(value: unknown): OrchestrationPlanFormModel {
  return stateObjectOrEmpty(value) as OrchestrationPlanFormModel;
}

function integerOr(value: unknown, fallback = 0): number {
  return Number.isInteger(value) ? (value as number) : fallback;
}

function orchestrationJobTargetsActionHandlers({
  onReplaceStringList = null,
}: Pick<JobTargetsEditorContext, "onReplaceStringList"> = {}) {
  return {
    replaceStringListHandler(listName = ""): (values: unknown) => unknown {
      return callbackHandler(onReplaceStringList, listName);
    },
  };
}

function orchestrationJobTargetsSectionCallbacks(
  model: OrchestrationPlanFormModel,
  stageIndex: number,
  jobIndex: number,
  onChange: PlanChangeHandler | null,
) {
  return {
    replaceStringList(listName: string, values: unknown): void {
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
}: JobTargetsEditorContext = {}) {
  const jobRowStateStore = writable(stateObjectOrEmpty(jobRow));
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
    }: JobTargetsEditorContext = {}) {
      jobRowStateStore.set(stateObjectOrEmpty(nextJobRow));
      callbackInputsStateStore.set({
        onReplaceStringList: nextOnReplaceStringList,
      });
    },
    targetActionHandlersStateStore,
  };
}

export function createOrchestrationJobTargetsSectionWorkspace() {
  const callbackInputsStateStore = writable<{
    jobIndex: number;
    model: OrchestrationPlanFormModel;
    onChange: PlanChangeHandler | null;
    stageIndex: number;
  }>({
    jobIndex: 0,
    model: planModelValue({}),
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
    }: JobTargetsSectionContext = {}) {
      callbackInputsStateStore.set({
        jobIndex: integerOr(nextJobIndex),
        model: planModelValue(nextModel),
        onChange: nextOnChange,
        stageIndex: integerOr(nextStageIndex),
      });
    },
  };
}

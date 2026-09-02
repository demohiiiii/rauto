import { derived as deriveStore, writable } from "svelte/store";
import { callbackHandler } from "../../../lib/events.js";
import { currentLanguageState, t } from "../../../lib/i18n.js";
import { orchestrationPlanFormModelFromJson } from "../model/orchestrationPlanFormModels.js";
import { orchestrationReplaceJobStringList } from "../model/orchestrationStageMutations.js";
import { orchestrationJobTargetsDisplay } from "../presentation/orchestrationFormStructureState.js";
import type {
  OrchestrationJobEditorRow,
  OrchestrationPlanChangeHandler,
  OrchestrationPlanFormModel,
} from "../model/types.js";

type ReplaceStringListHandler = (
  listName: string,
  values: readonly string[],
) => void;

interface JobTargetsEditorContext {
  jobRow?: Partial<OrchestrationJobEditorRow>;
  onReplaceStringList?: ReplaceStringListHandler | null;
}

interface JobTargetsSectionContext {
  jobIndex?: number;
  model?: OrchestrationPlanFormModel;
  onChange?: OrchestrationPlanChangeHandler | null;
  stageIndex?: number;
}

function orchestrationJobTargetsActionHandlers({
  onReplaceStringList = null,
}: Pick<JobTargetsEditorContext, "onReplaceStringList"> = {}) {
  return {
    replaceStringListHandler(
      listName = "",
    ): (values: readonly string[]) => void | undefined {
      return callbackHandler(onReplaceStringList, listName);
    },
  };
}

function orchestrationJobTargetsSectionCallbacks(
  model: OrchestrationPlanFormModel,
  stageIndex: number,
  jobIndex: number,
  onChange: OrchestrationPlanChangeHandler | null,
) {
  return {
    replaceStringList(listName: string, values: readonly string[]): void {
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
  const jobRowStateStore = writable<Partial<OrchestrationJobEditorRow>>(jobRow);
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
      jobRowStateStore.set(nextJobRow);
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
    onChange: OrchestrationPlanChangeHandler | null;
    stageIndex: number;
  }>({
    jobIndex: 0,
    model: orchestrationPlanFormModelFromJson({}),
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
      model: nextModel,
      onChange: nextOnChange = null,
      stageIndex: nextStageIndex = 0,
    }: JobTargetsSectionContext = {}) {
      callbackInputsStateStore.set({
        jobIndex: nextJobIndex,
        model: nextModel ?? orchestrationPlanFormModelFromJson({}),
        onChange: nextOnChange,
        stageIndex: nextStageIndex,
      });
    },
  };
}

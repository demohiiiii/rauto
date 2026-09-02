<script lang="ts">
  import { createOrchestrationJobTargetsSectionWorkspace } from "$domains/orchestration/index.js";
  import OrchestrationJobTargetsEditor from "$domains/orchestration/presentation/components/editor/OrchestrationJobTargetsEditor.svelte";
  import type {
    OrchestrationJobEditorRow,
    OrchestrationPlanChangeHandler,
    OrchestrationPlanFormModel,
  } from "$domains/orchestration/index.js";

  interface Props {
    jobRow: OrchestrationJobEditorRow;
    model: OrchestrationPlanFormModel;
    onChange?: OrchestrationPlanChangeHandler | null;
    stageIndex: number;
  }

  let { model, stageIndex, jobRow, onChange = null }: Props = $props();

  const jobTargetsSectionWorkspace =
    createOrchestrationJobTargetsSectionWorkspace();
  const { sectionCallbacksStateStore, setJobTargetsSectionContext } =
    jobTargetsSectionWorkspace;
  let sectionCallbacks = $derived($sectionCallbacksStateStore);

  $effect(() => {
    setJobTargetsSectionContext({
      jobIndex: jobRow.jobIndex,
      model,
      onChange,
      stageIndex,
    });
  });
</script>

<OrchestrationJobTargetsEditor
  {jobRow}
  onReplaceStringList={sectionCallbacks.replaceStringList}
/>

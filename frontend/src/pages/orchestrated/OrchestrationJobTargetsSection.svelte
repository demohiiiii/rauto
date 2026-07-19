<script>
  import { createOrchestrationJobTargetsSectionWorkspace } from "../../modules/orchestration/orchestrationStageTargetsState.js";
  import OrchestrationJobTargetsEditor from "./OrchestrationJobTargetsEditor.svelte";

  let { model, stageIndex, jobRow, onChange } = $props();

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

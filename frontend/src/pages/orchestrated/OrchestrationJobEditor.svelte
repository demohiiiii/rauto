<script>
  import { createOrchestrationJobEditorWorkspace } from "../../modules/orchestrationStageState.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import OrchestrationJobActionEditor from "./OrchestrationJobActionEditor.svelte";
  import OrchestrationJobSettingsEditor from "./OrchestrationJobSettingsEditor.svelte";
  import OrchestrationJobTargetsSection from "./OrchestrationJobTargetsSection.svelte";

  let {
    model,
    stageIndex,
    jobRow,
    visualDisplay,
    onChange,
    onErrorChange,
    onRemove,
  } = $props();
  const orchestrationJobEditorWorkspace =
    createOrchestrationJobEditorWorkspace();
  const { jobEditorDisplayStateStore, jobRowStateStore, setJobRow } =
    orchestrationJobEditorWorkspace;
  let jobEditorDisplay = $derived($jobEditorDisplayStateStore);
  let syncedJobRow = $derived($jobRowStateStore);

  $effect(() => {
    setJobRow(jobRow);
  });
</script>

<div class="rounded-lg border border-border p-3">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <span>{jobEditorDisplay.titleText}</span>
    <Button variant="ghost" size="sm" type="button" onclick={onRemove}>
      {jobEditorDisplay.removeButtonLabel}
    </Button>
  </div>
  <OrchestrationJobSettingsEditor
    {model}
    {stageIndex}
    jobIndex={syncedJobRow.jobIndex}
    job={syncedJobRow.job}
    {visualDisplay}
    {onChange}
  />

  <OrchestrationJobTargetsSection
    {model}
    {stageIndex}
    jobRow={syncedJobRow}
    {visualDisplay}
    {onChange}
    {onErrorChange}
  />

  <OrchestrationJobActionEditor
    {model}
    {stageIndex}
    jobIndex={syncedJobRow.jobIndex}
    jobRow={syncedJobRow}
    {visualDisplay}
    {onChange}
    {onErrorChange}
  />
</div>

<script>
  import { createOrchestrationJobTargetsSectionWorkspace } from "../../modules/orchestrationStageTargetsState.js";
  import OrchestrationJobTargetsEditor from "./OrchestrationJobTargetsEditor.svelte";

  let { model, stageIndex, jobRow, visualDisplay, onChange } = $props();

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
  {visualDisplay}
  onAddStringListItem={sectionCallbacks.addStringListItem}
  onAddTarget={sectionCallbacks.addTarget}
  onRemoveStringListItem={sectionCallbacks.removeStringListItem}
  onRemoveTarget={sectionCallbacks.removeTarget}
  onSetListPresence={sectionCallbacks.setListPresence}
  onTargetConnectionChange={sectionCallbacks.changeTargetConnection}
  onTargetExtraChange={sectionCallbacks.changeTargetExtra}
  onTargetFieldChange={sectionCallbacks.changeTargetField}
  onTargetFieldNullableModeChange={sectionCallbacks.changeTargetFieldMode}
  onTargetFieldPresenceChange={sectionCallbacks.setTargetFieldPresence}
  onTargetKindChange={sectionCallbacks.changeTargetKind}
  onTargetVarsChange={sectionCallbacks.changeTargetVars}
  onTargetVarsPresenceChange={sectionCallbacks.setTargetVarsPresence}
  onUpdateStringListItem={sectionCallbacks.updateStringListItem}
/>

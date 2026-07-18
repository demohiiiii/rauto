<script>
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import { createOrchestrationJobSettingsEditorWorkspace } from "../../modules/orchestrationStageEditorsState.js";

  let { model, stageIndex, jobIndex, job, visualDisplay, onChange } = $props();
  const orchestrationJobSettingsEditorWorkspace =
    createOrchestrationJobSettingsEditorWorkspace();
  const {
    jobSettingsCallbacksStateStore,
    settingsPanelDisplayStateStore,
    setJobSettingsContext,
  } = orchestrationJobSettingsEditorWorkspace;
  let settingsPanelDisplay = $derived($settingsPanelDisplayStateStore);
  let jobSettingsCallbacks = $derived($jobSettingsCallbacksStateStore);

  $effect(() => {
    setJobSettingsContext({
      job,
      jobIndex,
      model,
      onChange,
      stageIndex,
      visualDisplay,
    });
  });
</script>

<div class="grid gap-3">
  <div class="grid gap-3 md:grid-cols-2">
    <PresenceFieldGrid
      fieldRows={settingsPanelDisplay.fieldRows}
      hostClass="contents"
      presenceControlsMode="hidden"
      onValueChangeForKey={jobSettingsCallbacks.fieldValueHandler}
    />
  </div>
</div>

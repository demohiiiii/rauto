<script>
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import { createOrchestrationPlanSettingsEditorWorkspace } from "../../modules/orchestration/orchestrationStageEditorsState.js";

  let { model, visualDisplay, onChange } = $props();
  const orchestrationPlanSettingsEditorWorkspace =
    createOrchestrationPlanSettingsEditorWorkspace();
  const {
    planSettingsCallbacksStateStore,
    settingsPanelDisplayStateStore,
    setPlanSettingsContext,
  } = orchestrationPlanSettingsEditorWorkspace;
  let settingsPanelDisplay = $derived($settingsPanelDisplayStateStore);
  let planSettingsCallbacks = $derived($planSettingsCallbacksStateStore);

  $effect(() => {
    setPlanSettingsContext({ model, onChange, visualDisplay });
  });
</script>

<div class="grid gap-4">
  <div class="grid gap-3 md:grid-cols-2">
    <PresenceFieldGrid
      fieldRows={settingsPanelDisplay.rootFieldRows}
      hostClass="contents"
      presenceControlsMode="hidden"
      onValueChangeForKey={planSettingsCallbacks.fieldValueHandler}
    />
  </div>
</div>

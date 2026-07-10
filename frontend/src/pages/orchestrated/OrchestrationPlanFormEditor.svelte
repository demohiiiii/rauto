<script>
  import OrchestrationPlanSettingsEditor from "./OrchestrationPlanSettingsEditor.svelte";
  import OrchestrationInventoryPanel from "./OrchestrationInventoryPanel.svelte";
  import OrchestrationStagesPanel from "./OrchestrationStagesPanel.svelte";

  let { model, visualDisplay, onChange, onErrorChange } = $props();
</script>

<div class="grid gap-4">
  <OrchestrationPlanSettingsEditor {model} {visualDisplay} {onChange} />

  <OrchestrationInventoryPanel {model} {onChange} {onErrorChange} />

  <OrchestrationStagesPanel {model} {onChange} {onErrorChange} />
</div>

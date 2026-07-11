<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import { createOrchestrationStagesPanelWorkspace } from "../../modules/orchestrationStageEditorsState.js";
  import OrchestrationStageEditor from "./OrchestrationStageEditor.svelte";

  let { model, onChange, onErrorChange } = $props();
  const orchestrationStagesPanelWorkspace =
    createOrchestrationStagesPanelWorkspace();
  const {
    panelCallbacksStateStore,
    setStagesPanelContext,
    stagesPanelDisplayStateStore,
    visualDisplayStateStore,
  } = orchestrationStagesPanelWorkspace;
  let panelCallbacks = $derived($panelCallbacksStateStore);
  let stagesPanelDisplay = $derived($stagesPanelDisplayStateStore);
  let visualDisplay = $derived($visualDisplayStateStore);

  $effect(() => {
    setStagesPanelContext({ model, onChange });
  });
</script>

<div class="grid gap-3">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <span>{stagesPanelDisplay.titleText}</span>
    <Button size="sm" type="button" onclick={panelCallbacks.addStage}>
      {stagesPanelDisplay.addStageButtonLabel}
    </Button>
  </div>
  {#each stagesPanelDisplay.stageRows as stageRow (stageRow.stageIndex)}
    <OrchestrationStageEditor
      {model}
      {stageRow}
      {visualDisplay}
      {onChange}
      {onErrorChange}
      onRemove={panelCallbacks.removeStageHandler(stageRow.stageIndex)}
    />
  {/each}
</div>

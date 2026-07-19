<script>
  import OrchestrationInputPanel from "./OrchestrationInputPanel.svelte";
  import { createOrchestrationStageWorkspace } from "../../modules/orchestration/orchestrationPanelState.js";

  let { active, onExecute, onImportFile, onEditorInput } = $props();
  const orchestrationStageWorkspace = createOrchestrationStageWorkspace();
  const { executionPanelDisplayStateStore, setStageContext } =
    orchestrationStageWorkspace;
  let orchestrationExecutionPanelDisplay = $derived(
    $executionPanelDisplayStateStore,
  );

  $effect(() => {
    setStageContext({ active });
  });
</script>

<div class="grid gap-2" hidden={!active}>
  <div class="grid gap-2">
    <OrchestrationInputPanel
      {active}
      {onEditorInput}
      {onExecute}
      {onImportFile}
      executionPanelDisplay={orchestrationExecutionPanelDisplay}
    />
  </div>
</div>

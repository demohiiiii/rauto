<script>
  import OrchestrationEditorRunPanel from "./OrchestrationEditorRunPanel.svelte";
  import { createOrchestrationInputPanelWorkspace } from "../../modules/orchestration/orchestrationPanelState.js";

  let {
    active,
    onEditorInput,
    onExecute,
    onImportFile,
    executionPanelDisplay,
  } = $props();

  const orchestrationInputWorkspace = createOrchestrationInputPanelWorkspace();
  const {
    editorSyncVersionStateStore,
    executeOrchestration,
    importFile,
    orchestrationEditorRunButtonDisplayStateStore,
    setInputPanelContext,
  } = orchestrationInputWorkspace;
  let orchestrationEditorSyncVersion = $derived($editorSyncVersionStateStore);
  let orchestrationEditorRunButtonDisplay = $derived(
    $orchestrationEditorRunButtonDisplayStateStore,
  );

  $effect(() => {
    setInputPanelContext({
      onExecute,
      onImportFile,
    });
  });
</script>

<OrchestrationEditorRunPanel
  {active}
  editorSyncVersion={orchestrationEditorSyncVersion}
  {orchestrationEditorRunButtonDisplay}
  {onEditorInput}
  onExecute={executeOrchestration}
  onImportFile={importFile}
  {executionPanelDisplay}
/>

<script lang="ts">
  import OrchestrationEditorRunPanel from "$domains/orchestration/presentation/components/editor/OrchestrationEditorRunPanel.svelte";
  import { createOrchestrationInputPanelWorkspace } from "$domains/orchestration/index.js";

  interface Props {
    active?: boolean;
    onEditorInput?: (text: string) => void;
    onExecute?: () => void;
  }

  let { active = false, onEditorInput, onExecute }: Props = $props();

  const orchestrationInputWorkspace = createOrchestrationInputPanelWorkspace();
  const {
    editorSyncVersionStateStore,
    executeOrchestration,
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
    });
  });
</script>

<OrchestrationEditorRunPanel
  {active}
  editorSyncVersion={orchestrationEditorSyncVersion}
  {orchestrationEditorRunButtonDisplay}
  {onEditorInput}
  onExecute={executeOrchestration}
/>

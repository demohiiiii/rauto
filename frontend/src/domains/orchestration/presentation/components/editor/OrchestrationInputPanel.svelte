<script lang="ts">
  import OrchestrationEditorRunPanel from "$domains/orchestration/presentation/components/editor/OrchestrationEditorRunPanel.svelte";
  import { createOrchestrationInputPanelWorkspace } from "$domains/orchestration/index.js";

  interface TextFile {
    text(): Promise<string>;
  }

  interface ExternalActionContext {
    isCurrent?: () => boolean;
  }

  interface Props {
    active?: boolean;
    onEditorInput?: (text: string) => void;
    onExecute?: () => void;
    onImportFile?: (
      file: TextFile,
      actionContext?: ExternalActionContext | null,
    ) => void;
  }

  let {
    active = false,
    onEditorInput,
    onExecute,
    onImportFile,
  }: Props = $props();

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
/>

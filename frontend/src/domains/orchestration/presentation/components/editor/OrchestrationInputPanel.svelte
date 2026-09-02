<script lang="ts">
  import OrchestrationEditorRunPanel from "$domains/orchestration/presentation/components/editor/OrchestrationEditorRunPanel.svelte";
  import { createOrchestrationInputPanelWorkspace } from "$domains/orchestration/index.js";
  import type { orchestrationExecutionPanelDisplay } from "$domains/orchestration/index.js";

  interface TextFile {
    text(): Promise<string>;
  }

  interface ExternalActionContext {
    isCurrent?: () => boolean;
  }

  type ExecutionPanelDisplay = ReturnType<
    typeof orchestrationExecutionPanelDisplay
  >;

  interface Props {
    active?: boolean;
    executionPanelDisplay: ExecutionPanelDisplay;
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
    executionPanelDisplay,
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
  {executionPanelDisplay}
/>

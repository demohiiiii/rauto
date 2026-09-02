<script lang="ts">
  import OrchestrationInputPanel from "./OrchestrationInputPanel.svelte";
  import { createOrchestrationStageWorkspace } from "$domains/orchestration/index.js";

  interface TextFile {
    text(): Promise<string>;
  }

  interface Props {
    active?: boolean;
    onEditorInput?: (text: string) => void;
    onExecute?: () => Promise<void> | void;
    onImportFile?: (file: TextFile) => Promise<void> | void;
  }

  let {
    active = false,
    onExecute,
    onImportFile,
    onEditorInput,
  }: Props = $props();
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

<script lang="ts">
  import OrchestrationInputPanel from "$domains/orchestration/presentation/components/editor/OrchestrationInputPanel.svelte";
  import ExecutionDock from "$components/fragments/ExecutionDock.svelte";

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
</script>

<ExecutionDock {active} feature="orchestrate">
  <div class="grid gap-2">
    <OrchestrationInputPanel
      {active}
      {onEditorInput}
      {onExecute}
      {onImportFile}
    />
  </div>
</ExecutionDock>

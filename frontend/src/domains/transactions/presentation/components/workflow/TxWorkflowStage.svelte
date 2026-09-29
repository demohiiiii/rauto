<script lang="ts">
  import TxWorkflowInputPanel from "$domains/transactions/presentation/components/workflow/TxWorkflowInputPanel.svelte";
  import ExecutionDock from "$components/fragments/ExecutionDock.svelte";
  import ExecutionRunBar from "$components/fragments/ExecutionRunBar.svelte";
  import { createTxWorkflowStageWorkspace } from "$domains/transactions/index.js";
  import type { JsonObject } from "$domains/transactions/index.js";

  interface Props {
    active?: boolean;
    onEditorInput?: (text: string) => void;
    onExecute?: () => void;
    onSaveBlockTemplate?: (block: JsonObject) => void | Promise<void>;
  }
  let {
    active = false,
    onExecute,
    onEditorInput,
    onSaveBlockTemplate,
  }: Props = $props();
  const txWorkflowStageWorkspace = createTxWorkflowStageWorkspace();
  const {
    executeWorkflow,
    setTxWorkflowStageContext,
    workflowOutputPanelDisplayStateStore,
  } = txWorkflowStageWorkspace;
  let workflowOutputPanelDisplay = $derived(
    $workflowOutputPanelDisplayStateStore,
  );

  $effect(() => {
    setTxWorkflowStageContext({
      active,
      onExecute,
    });
  });
</script>

<ExecutionDock {active} feature="tx-workflow">
  <div class="grid gap-2">
    <TxWorkflowInputPanel {active} {onEditorInput} {onSaveBlockTemplate} />
    <ExecutionRunBar
      {active}
      buttonLabel={workflowOutputPanelDisplay.executeButtonLabel}
      loading={workflowOutputPanelDisplay.loadingDisplay.execute}
      showAutoDownloadOutput={false}
      onRun={executeWorkflow}
    />
  </div>
</ExecutionDock>

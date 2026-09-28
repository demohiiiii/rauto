<script lang="ts">
  import TxWorkflowInputPanel from "$domains/transactions/presentation/components/workflow/TxWorkflowInputPanel.svelte";
  import ExecutionDock from "$components/fragments/ExecutionDock.svelte";
  import ExecutionRunBar from "$components/fragments/ExecutionRunBar.svelte";
  import { createTxWorkflowStageWorkspace } from "$domains/transactions/index.js";
  import type {
    JsonTemplateActionContext,
    TransactionTemplateResource,
  } from "$domains/transactions/index.js";

  interface TextFile {
    text(): Promise<string>;
  }

  interface Props {
    active?: boolean;
    onCreateJsonTemplateDraft?: (
      actionContext?: JsonTemplateActionContext | null,
    ) => void;
    onEditorInput?: (text: string) => void;
    onExecute?: () => void;
    onImportFile?: (
      file: TextFile,
      actionContext?: JsonTemplateActionContext | null,
    ) => void;
    onLoadJsonTemplate?: (
      templateName: string,
      actionContext?: JsonTemplateActionContext | null,
    ) => Promise<TransactionTemplateResource | null>;
    onPreview?: () => void;
    onSaveJsonTemplate?: () => void;
    onSaveBlockTemplate?: (
      block: Record<string, unknown>,
    ) => void | Promise<void>;
  }

  let {
    active = false,
    onCreateJsonTemplateDraft,
    onPreview,
    onExecute,
    onImportFile,
    onEditorInput,
    onLoadJsonTemplate,
    onSaveJsonTemplate,
    onSaveBlockTemplate,
  }: Props = $props();
  const txWorkflowStageWorkspace = createTxWorkflowStageWorkspace();
  const {
    createDirectDraft,
    executeWorkflow,
    importFile,
    jsonNewLoadingStateStore,
    setTxWorkflowStageContext,
    workflowOutputPanelDisplayStateStore,
  } = txWorkflowStageWorkspace;
  let jsonNewLoading = $derived($jsonNewLoadingStateStore);
  let workflowOutputPanelDisplay = $derived(
    $workflowOutputPanelDisplayStateStore,
  );

  async function createWorkflowDirectDraft(
    actionContext?: JsonTemplateActionContext | null,
  ): Promise<void> {
    await createDirectDraft(actionContext);
  }

  async function importWorkflowFile(
    file: File,
    actionContext?: JsonTemplateActionContext | null,
  ): Promise<void> {
    await importFile(file, actionContext);
  }

  $effect(() => {
    setTxWorkflowStageContext({
      active,
      onCreateJsonTemplateDraft,
      onExecute,
      onImportFile,
      onPreview,
    });
  });
</script>

<ExecutionDock {active} feature="tx-workflow">
  <div class="grid gap-2">
    <TxWorkflowInputPanel
      {active}
      {jsonNewLoading}
      onCreateDirectDraft={createWorkflowDirectDraft}
      {onCreateJsonTemplateDraft}
      {onEditorInput}
      onImportFile={importWorkflowFile}
      {onLoadJsonTemplate}
      {onSaveJsonTemplate}
      {onSaveBlockTemplate}
    />
    <ExecutionRunBar
      {active}
      buttonLabel={workflowOutputPanelDisplay.executeButtonLabel}
      loading={workflowOutputPanelDisplay.loadingDisplay.execute}
      showAutoDownloadOutput={false}
      onRun={executeWorkflow}
    />
  </div>
</ExecutionDock>

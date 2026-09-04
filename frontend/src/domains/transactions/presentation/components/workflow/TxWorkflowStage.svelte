<script lang="ts">
  import TxWorkflowInputPanel from "$domains/transactions/presentation/components/workflow/TxWorkflowInputPanel.svelte";
  import TxWorkflowRunPanel from "$domains/transactions/presentation/components/workflow/TxWorkflowRunPanel.svelte";
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

<div class="grid gap-2" hidden={!active}>
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
    />
    <TxWorkflowRunPanel
      panelDisplay={workflowOutputPanelDisplay}
      onExecute={executeWorkflow}
    />
  </div>
</div>

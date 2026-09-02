<script lang="ts">
  import TxWorkflowInputPanel from "./TxWorkflowInputPanel.svelte";
  import TxWorkflowRunPanel from "./TxWorkflowRunPanel.svelte";
  import { createTxWorkflowStageWorkspace } from "$domains/transactions/index.js";

  interface TextFile {
    text(): Promise<string>;
  }

  interface ExternalActionContext {
    isCurrent?: () => boolean;
  }

  interface Props {
    active?: boolean;
    onCreateJsonTemplateDraft?: (
      actionContext?: ExternalActionContext | null,
    ) => void;
    onEditorInput?: (text: string) => void;
    onExecute?: () => void;
    onImportFile?: (
      file: TextFile,
      actionContext?: ExternalActionContext | null,
    ) => void;
    onLoadJsonTemplate?: (
      templateName: string,
      actionContext?: ExternalActionContext | null,
    ) => void;
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
      onCreateDirectDraft={createDirectDraft}
      {onCreateJsonTemplateDraft}
      {onEditorInput}
      onImportFile={importFile}
      {onLoadJsonTemplate}
      {onSaveJsonTemplate}
    />
    <TxWorkflowRunPanel
      panelDisplay={workflowOutputPanelDisplay}
      onExecute={executeWorkflow}
    />
  </div>
</div>

<script>
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import OrchestrationExecutionPanel from "./OrchestrationExecutionPanel.svelte";
  import OrchestrationInputPanel from "./OrchestrationInputPanel.svelte";
  import OrchestrationPreviewPanel from "./OrchestrationPreviewPanel.svelte";
  import { createOrchestrationStageWorkspace } from "../../modules/orchestrationWorkspace.js";

  let {
    active,
    onCreateJsonTemplateDraft,
    onDeleteJsonTemplate,
    onDirectMode,
    onTemplateMode,
    onPreview,
    onExecute,
    onImportFile,
    onEditorInput,
    onLoadJsonTemplate,
    onSaveJsonTemplate,
  } = $props();
  const orchestrationStageWorkspace = createOrchestrationStageWorkspace();
  const {
    executionPanelDisplayStateStore,
    previewDisplayStateStore,
    setStageContext,
    stageDisplayStateStore,
  } = orchestrationStageWorkspace;
  let stageDisplay = $derived($stageDisplayStateStore);
  let previewDisplay = $derived($previewDisplayStateStore);
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
      {onCreateJsonTemplateDraft}
      {onDeleteJsonTemplate}
      {onDirectMode}
      {onEditorInput}
      {onExecute}
      {onImportFile}
      {onLoadJsonTemplate}
      {onPreview}
      {onSaveJsonTemplate}
      {onTemplateMode}
    />
    <OrchestrationPreviewPanel
      inventory={previewDisplay.inventory}
      message={previewDisplay.message}
      plan={previewDisplay.plan}
      previewMode={previewDisplay.previewMode}
      text={previewDisplay.text}
      tone={previewDisplay.tone}
    />
    {#if stageDisplay.planStatus.showStatus}
      <div class="mt-2 grid gap-2">
        <StatusCard
          message={stageDisplay.planStatus.message}
          tone={stageDisplay.planStatus.tone}
        />
      </div>
    {/if}
    <OrchestrationExecutionPanel
      panelDisplay={orchestrationExecutionPanelDisplay}
    />
  </div>
</div>

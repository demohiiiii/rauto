<script>
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import ValueTextSelectField from "../../components/fragments/ValueTextSelectField.svelte";
  import OrchestrationVarsFormCard from "./OrchestrationVarsFormCard.svelte";
  import TxJsonFormSurface from "./TxJsonFormSurface.svelte";
  import { createTxTemplateRunPanelWorkspace } from "../../modules/transactionInputWorkspaces.js";

  let {
    active,
    "aria-label": ariaLabel,
    "hidden-textarea": hiddenTextarea,
    hintKeys,
    onCreateTemplateDraft,
    onDeleteTemplate,
    onLoadTemplate,
    onSaveTemplate,
    templateKind,
    varsKey,
    varsPlaceholderFallback,
    varsPlaceholderKey,
    varsPrefix,
  } = $props();

  const txTemplateRunPanelWorkspace = createTxTemplateRunPanelWorkspace({
    getTemplateKind: () => templateKind,
    getVarsKey: () => varsKey,
  });
  const {
    changeVarsText,
    createTemplateDraft,
    deleteTemplate,
    editorDisplayModeStateStore,
    loadTemplate,
    loadingStateStore,
    panelDisplayStateStore,
    saveTemplate,
    selectEditorView,
    setTemplateRunPanelContext,
    templateChangeHandler,
  } = txTemplateRunPanelWorkspace;
  let txTemplateRunLoadingState = $derived($loadingStateStore);
  let editorDisplayMode = $derived($editorDisplayModeStateStore);
  let panelDisplay = $derived($panelDisplayStateStore);
  let deleteTemplateLoading = $derived(
    txTemplateRunLoadingState.deleteTemplateLoading,
  );
  let loadTemplateLoading = $derived(
    txTemplateRunLoadingState.loadTemplateLoading,
  );
  let newTemplateLoading = $derived(
    txTemplateRunLoadingState.newTemplateLoading,
  );
  let saveTemplateLoading = $derived(
    txTemplateRunLoadingState.saveTemplateLoading,
  );

  $effect(() => {
    setTemplateRunPanelContext({
      ariaLabel,
      hintKeys,
      onCreateTemplateDraft,
      onDeleteTemplate,
      onLoadTemplate,
      onSaveTemplate,
      varsPlaceholderFallback,
      varsPlaceholderKey,
    });
  });
</script>

<div class="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
  <ValueTextSelectField
    title={panelDisplay.selectPlaceholder}
    aria-label={panelDisplay.selectPlaceholder}
    value={panelDisplay.selectedTemplate}
    optionRows={panelDisplay.templateOptionRows}
    placeholderText={panelDisplay.selectPlaceholder}
    disabled={loadTemplateLoading}
    onChange={templateChangeHandler()}
  />
  <LoadingButton
    variant="outline"
    size="sm"
    loading={newTemplateLoading}
    onclick={createTemplateDraft}
  >
    <span>{panelDisplay.newButtonLabel}</span>
  </LoadingButton>
  <LoadingButton
    variant="default"
    size="sm"
    loading={saveTemplateLoading}
    onclick={saveTemplate}
  >
    <span>{panelDisplay.saveButtonLabel}</span>
  </LoadingButton>
  <LoadingButton
    variant="destructive"
    size="sm"
    loading={deleteTemplateLoading}
    onclick={deleteTemplate}
  >
    <span>{panelDisplay.deleteButtonLabel}</span>
  </LoadingButton>
</div>
{#if hiddenTextarea}
  <OrchestrationVarsFormCard {active} prefix={varsPrefix} />
{:else}
  <TxJsonFormSurface
    {active}
    {editorDisplayMode}
    editorKind="inline"
    editorTitle={panelDisplay.textareaLabel}
    editorValue={panelDisplay.varsText}
    onInlineEditorChange={changeVarsText}
    onEditorViewSelect={selectEditorView}
    placeholder={panelDisplay.varsPlaceholderText}
  >
    {#snippet formContent()}
      <OrchestrationVarsFormCard {active} prefix={varsPrefix} />
    {/snippet}
  </TxJsonFormSurface>
{/if}
{#each panelDisplay.hintRows as hintRow}
  <div class="text-xs text-slate-500">
    {hintRow.hintText}
  </div>
{/each}

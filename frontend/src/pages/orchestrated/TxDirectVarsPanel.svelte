<script>
  import { createTxDirectVarsPanelWorkspace } from "../../modules/transactionInputWorkspaces.js";
  import OrchestrationVarsFormCard from "./OrchestrationVarsFormCard.svelte";
  import TxJsonFormSurface from "./TxJsonFormSurface.svelte";

  let {
    active,
    "aria-label": ariaLabel,
    "hidden-textarea": hiddenTextarea,
    hintKey,
    placeholderFallback,
    placeholderKey,
    prefix,
    varsKey,
  } = $props();

  const txDirectVarsPanelWorkspace = createTxDirectVarsPanelWorkspace({
    getPanelConfig: () => ({
      ariaLabel,
      hintKey,
      placeholderFallback,
      placeholderKey,
      varsKey,
    }),
  });
  const { changeVarsText, panelDisplayStateStore } = txDirectVarsPanelWorkspace;
  let editorDisplayMode = $state("form");
  let panelDisplay = $derived($panelDisplayStateStore);

  function selectEditorView(nextEditorDisplayMode) {
    editorDisplayMode = nextEditorDisplayMode;
  }
</script>

{#if hiddenTextarea}
  <OrchestrationVarsFormCard {active} {prefix} />
  {#if panelDisplay.showHint}
    <div class="text-xs text-slate-500">
      {panelDisplay.hintText}
    </div>
  {/if}
{:else}
  <TxJsonFormSurface
    {active}
    {editorDisplayMode}
    editorKind="inline"
    editorTitle={panelDisplay.textareaLabel}
    editorValue={panelDisplay.varsText}
    formError={panelDisplay.formError}
    jsonHintText={panelDisplay.showHint ? panelDisplay.hintText : ""}
    onInlineEditorChange={changeVarsText}
    onEditorViewSelect={selectEditorView}
    placeholder={panelDisplay.placeholderText}
  >
    {#snippet formContent()}
      <OrchestrationVarsFormCard {active} {prefix} />
    {/snippet}
  </TxJsonFormSurface>
{/if}

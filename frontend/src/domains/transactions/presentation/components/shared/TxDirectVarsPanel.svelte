<script lang="ts">
  import { createTxDirectVarsPanelWorkspace } from "$domains/transactions/index.js";
  import type { TransactionEditorView } from "$domains/transactions/index.js";
  import OrchestrationVarsFormCard from "$domains/orchestration/presentation/components/editor/OrchestrationVarsFormCard.svelte";
  import TxJsonFormSurface from "$domains/transactions/presentation/components/shared/TxJsonFormSurface.svelte";

  interface Props {
    active?: boolean;
    "aria-label"?: string;
    "hidden-textarea"?: boolean;
    hintKey?: string;
    placeholderFallback?: string;
    placeholderKey?: string;
    prefix: string;
    varsKey: string;
  }

  let {
    active = false,
    "aria-label": ariaLabel = "",
    "hidden-textarea": hiddenTextarea = false,
    hintKey = "",
    placeholderFallback = "",
    placeholderKey = "",
    prefix,
    varsKey,
  }: Props = $props();

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
  let editorDisplayMode = $state<TransactionEditorView>("form");
  let panelDisplay = $derived($panelDisplayStateStore);

  function selectEditorView(nextEditorDisplayMode: TransactionEditorView) {
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
    onEditorInput={undefined}
    onEditorViewSelect={selectEditorView}
    placeholder={panelDisplay.placeholderText}
  >
    {#snippet formContent()}
      <OrchestrationVarsFormCard {active} {prefix} />
    {/snippet}
  </TxJsonFormSurface>
{/if}

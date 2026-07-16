<script>
  import TxBlockInputPanel from "./TxBlockInputPanel.svelte";
  import TxBlockRunPanel from "./TxBlockRunPanel.svelte";
  import { createTxBlockStageWorkspace } from "../../modules/transactionPanelState.js";

  let {
    active,
    newButtonLabelKey,
    onCreateJsonTemplateDraft,
    onExecute,
    onEditorInput,
    onLoadJsonTemplate,
  } = $props();
  const txBlockStageWorkspace = createTxBlockStageWorkspace();
  const { execute, setTxBlockStageContext, txBlockRunPanelDisplayStateStore } =
    txBlockStageWorkspace;
  let txBlockRunPanelDisplay = $derived($txBlockRunPanelDisplayStateStore);

  $effect(() => {
    setTxBlockStageContext({
      active,
      onExecute,
    });
  });
</script>

<div class="grid gap-3" hidden={!active}>
  <TxBlockInputPanel
    {active}
    {onCreateJsonTemplateDraft}
    {onEditorInput}
    {onLoadJsonTemplate}
    {newButtonLabelKey}
  />
  <TxBlockRunPanel onExecute={execute} panelDisplay={txBlockRunPanelDisplay} />
</div>

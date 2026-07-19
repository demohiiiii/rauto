<script>
  import TxBlockInputPanel from "./TxBlockInputPanel.svelte";
  import TxBlockRunPanel from "./TxBlockRunPanel.svelte";
  import { createTxBlockStageWorkspace } from "../../modules/transactions/transactionPanelState.js";

  let {
    active,
    newButtonLabelKey,
    onCreateJsonTemplateDraft,
    onExecute,
    onEditorInput,
    onImportFile,
    onLoadJsonTemplate,
    onSaveJsonTemplate,
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
    {onImportFile}
    {onLoadJsonTemplate}
    {onSaveJsonTemplate}
    {newButtonLabelKey}
  />
  <TxBlockRunPanel onExecute={execute} panelDisplay={txBlockRunPanelDisplay} />
</div>

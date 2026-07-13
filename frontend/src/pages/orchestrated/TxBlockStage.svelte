<script>
  import TxBlockInputPanel from "./TxBlockInputPanel.svelte";
  import TxBlockRunPanel from "./TxBlockRunPanel.svelte";
  import { createTxBlockStageWorkspace } from "../../modules/transactionPanelState.js";

  let {
    active,
    newButtonLabelKey,
    onCreateJsonTemplateDraft,
    onDeleteJsonTemplate,
    onDirectMode,
    onDirectExecute,
    onEditorInput,
    onLoadJsonTemplate,
    onSaveJsonTemplate,
    onTemplateMode,
    onTemplateExecute,
  } = $props();
  const txBlockStageWorkspace = createTxBlockStageWorkspace();
  const {
    runDirectExecute,
    runTemplateExecute,
    setTxBlockStageContext,
    txBlockRunPanelDisplayStateStore,
  } = txBlockStageWorkspace;
  let txBlockRunPanelDisplay = $derived($txBlockRunPanelDisplayStateStore);

  $effect(() => {
    setTxBlockStageContext({
      active,
      onDirectExecute,
      onTemplateExecute,
    });
  });
</script>

<div class="grid gap-3" hidden={!active}>
  <TxBlockInputPanel
    {active}
    {onCreateJsonTemplateDraft}
    {onDeleteJsonTemplate}
    {onDirectMode}
    {onEditorInput}
    {onLoadJsonTemplate}
    {newButtonLabelKey}
    {onSaveJsonTemplate}
    {onTemplateMode}
  />
  <TxBlockRunPanel
    onDirectExecute={runDirectExecute}
    onTemplateExecute={runTemplateExecute}
    panelDisplay={txBlockRunPanelDisplay}
  />
</div>

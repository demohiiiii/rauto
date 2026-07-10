<script>
  import TxBlockInputPanel from "./TxBlockInputPanel.svelte";
  import TxBlockRunPanel from "./TxBlockRunPanel.svelte";
  import { createTxBlockStageWorkspace } from "../../modules/transactionsWorkspace.js";

  let {
    active,
    newButtonLabelKey,
    onCreateJsonTemplateDraft,
    onDeleteJsonTemplate,
    onDirectMode,
    onDirectPlan,
    onDirectExecute,
    onEditorInput,
    onLoadJsonTemplate,
    onSaveJsonTemplate,
    onTemplateMode,
    onTemplatePlan,
    onTemplateExecute,
  } = $props();
  const txBlockStageWorkspace = createTxBlockStageWorkspace();
  const {
    runDirectExecute,
    runDirectPlan,
    runTemplateExecute,
    runTemplatePlan,
    setTxBlockStageContext,
    txBlockRunPanelDisplayStateStore,
  } = txBlockStageWorkspace;
  let txBlockRunPanelDisplay = $derived($txBlockRunPanelDisplayStateStore);

  $effect(() => {
    setTxBlockStageContext({
      active,
      onDirectExecute,
      onDirectPlan,
      onTemplateExecute,
      onTemplatePlan,
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
    onDirectPlan={runDirectPlan}
    onTemplateExecute={runTemplateExecute}
    onTemplatePlan={runTemplatePlan}
    panelDisplay={txBlockRunPanelDisplay}
  />
</div>

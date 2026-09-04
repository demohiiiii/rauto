<script lang="ts">
  import TxBlockInputPanel from "$domains/transactions/presentation/components/block/TxBlockInputPanel.svelte";
  import TxBlockRunPanel from "$domains/transactions/presentation/components/block/TxBlockRunPanel.svelte";
  import { createTxBlockStageWorkspace } from "$domains/transactions/index.js";
  import type {
    JsonTemplateActionContext,
    TransactionTemplateResource,
  } from "$domains/transactions/index.js";

  interface TextFile {
    text(): Promise<string>;
  }

  interface Props {
    active?: boolean;
    newButtonLabelKey?: string;
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
    onSaveJsonTemplate?: () => void;
  }

  let {
    active = false,
    newButtonLabelKey = "",
    onCreateJsonTemplateDraft,
    onExecute,
    onEditorInput,
    onImportFile,
    onLoadJsonTemplate,
    onSaveJsonTemplate,
  }: Props = $props();
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

<script lang="ts">
  import TxBlockInputPanel from "./TxBlockInputPanel.svelte";
  import TxBlockRunPanel from "./TxBlockRunPanel.svelte";
  import { createTxBlockStageWorkspace } from "$domains/transactions/index.js";

  interface TextFile {
    text(): Promise<string>;
  }

  interface ExternalActionContext {
    isCurrent?: () => boolean;
  }

  interface Props {
    active?: boolean;
    newButtonLabelKey?: string;
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

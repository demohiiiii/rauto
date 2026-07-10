<script>
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { t } from "../../lib/i18n.js";
  import { createTxWorkflowVisualEditorWorkspace } from "../../modules/transactionWorkflowEditors.js";
  import TxBlockRootSettingsEditor from "./TxBlockRootSettingsEditor.svelte";
  import TxWorkflowBlockEditor from "./TxWorkflowBlockEditor.svelte";

  let { model, onChange } = $props();

  const txWorkflowVisualEditorWorkspace =
    createTxWorkflowVisualEditorWorkspace();
  const {
    blockRowsStateStore,
    editorDisplayStateStore,
    rootMetadataFieldRowsStateStore,
    rootMetadataSourceStateStore,
    setVisualEditorContext,
    workflowActionHandlersStateStore,
    workflowRootFieldRowsStateStore,
  } = txWorkflowVisualEditorWorkspace;
  let blockRows = $derived($blockRowsStateStore);
  let workflowActionHandlers = $derived($workflowActionHandlersStateStore);
  let editorDisplay = $derived($editorDisplayStateStore);
  let rootMetadataFieldRows = $derived($rootMetadataFieldRowsStateStore);
  let rootMetadataSource = $derived($rootMetadataSourceStateStore);
  let workflowRootFieldRows = $derived($workflowRootFieldRowsStateStore);

  $effect(() => {
    setVisualEditorContext({ model, onChange });
  });
</script>

<div class="grid gap-4">
  <TxBlockRootSettingsEditor
    fieldRows={workflowRootFieldRows}
    metadataFieldRows={rootMetadataFieldRows}
    onValueChange={workflowActionHandlers.valueHandler}
    onPresenceChange={workflowActionHandlers.presenceToggle}
    onMetadataValueChange={workflowActionHandlers.extraValueHandler}
    onMetadataPresenceChange={workflowActionHandlers.extraPresenceHandler}
  />

  <JsonObjectFieldsEditor
    title={t("txWorkflowFormRootExtra")}
    source={rootMetadataSource}
    typeRows={editorDisplay.jsonValueTypeRows}
    onChange={workflowActionHandlers.setRootExtra}
  />

  <div class="flex flex-wrap items-center justify-between gap-3">
    <span>{t("txWorkflowFormBlocks")}</span>
    <Button
      size="sm"
      type="button"
      onclick={workflowActionHandlers.appendBlock}
    >
      {t("txWorkflowFormAddBlock")}
    </Button>
  </div>

  {#each blockRows as blockRow}
    <TxWorkflowBlockEditor
      {blockRow}
      {editorDisplay}
      blockActionHandlers={workflowActionHandlers.blockBindings(
        blockRow.blockIndex,
      )}
    />
  {/each}
</div>

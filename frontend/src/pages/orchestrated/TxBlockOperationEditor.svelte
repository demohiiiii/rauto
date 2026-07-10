<script>
  import TerminalIcon from "@lucide/svelte/icons/terminal";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import TxBlockCommandEditor from "./TxBlockCommandEditor.svelte";
  import TxBlockFlowEditor from "./TxBlockFlowEditor.svelte";
  import TxBlockTemplateEditor from "./TxBlockTemplateEditor.svelte";
  import { t } from "../../lib/i18n.js";
  import TxFormSection from "./TxFormSection.svelte";
  import { createTxBlockOperationEditorWorkspace } from "../../modules/transactionBlockDisplays.js";

  let {
    operation,
    title,
    editorDisplay,
    commandMetadataFieldDefs = [],
    onChange,
  } = $props();
  const txBlockOperationEditorWorkspace =
    createTxBlockOperationEditorWorkspace();
  const {
    operationActionHandlersStateStore,
    operationFieldRowsStateStore,
    setOperationEditorContext,
  } = txBlockOperationEditorWorkspace;
  let operationActionHandlers = $derived($operationActionHandlersStateStore);
  let operationFieldRows = $derived($operationFieldRowsStateStore);

  $effect(() => {
    setOperationEditorContext({
      operation,
      onChange,
      titleText: title,
    });
  });
</script>

<div class="rounded-2xl border border-border bg-muted/30 p-4">
  <TxFormSection
    icon={TerminalIcon}
    {title}
    description={t("txBlockFormOperationHint")}
  >
    <PresenceFieldGrid
      fieldRows={operationFieldRows}
      hostClass="grid gap-3 md:grid-cols-2"
      onValueChange={operationActionHandlers.setKind}
    />
  </TxFormSection>
  <div class="mt-4">
    {#if operation.kind === "flow"}
      <TxBlockFlowEditor
        {operation}
        {onChange}
        booleanRows={editorDisplay.booleanRows}
        jsonValueTypeRows={editorDisplay.jsonValueTypeRows}
      />
    {:else if operation.kind === "template"}
      <TxBlockTemplateEditor
        {operation}
        {onChange}
        booleanRows={editorDisplay.booleanRows}
        jsonValueTypeRows={editorDisplay.jsonValueTypeRows}
        templateVarTypeRows={editorDisplay.templateVarTypeRows}
      />
    {:else}
      <TxBlockCommandEditor
        command={operation.command}
        metadataFieldDefs={commandMetadataFieldDefs}
        onChange={operationActionHandlers.setCommand}
        jsonValueTypeRows={editorDisplay.jsonValueTypeRows}
      />
    {/if}
  </div>
</div>

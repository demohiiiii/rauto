<script>
  import * as Tabs from "$lib/components/ui/tabs/index.js";
  import TxBlockCommandEditor from "./TxBlockCommandEditor.svelte";
  import TxBlockFlowEditor from "./TxBlockFlowEditor.svelte";
  import TxBlockTemplateEditor from "./TxBlockTemplateEditor.svelte";
  import { t } from "../../lib/i18n.js";
  import { createTxBlockOperationEditorWorkspace } from "../../modules/transactionBlockDisplays.js";

  let {
    operation,
    title,
    editorDisplay,
    commandMetadataFieldDefs = [],
    onChange,
    validationErrors = [],
    pathPrefix = "",
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
      validationErrors,
      pathPrefix,
    });
  });
</script>

<div class="grid gap-4">
  <div class="grid gap-2">
    <h3 class="text-sm font-semibold text-foreground">{title}</h3>
    <Tabs.Root
      value={operation.kind}
      onValueChange={operationActionHandlers.setKind}
      class="w-full"
    >
      <Tabs.List class="grid w-full grid-cols-3" aria-label={title}>
        <Tabs.Trigger value="command">{t("txBlockFormCommand")}</Tabs.Trigger>
        <Tabs.Trigger value="flow">{t("txBlockOperationKindFlow")}</Tabs.Trigger
        >
        <Tabs.Trigger value="template"
          >{t("txBlockOperationKindTemplate")}</Tabs.Trigger
        >
      </Tabs.List>
    </Tabs.Root>
  </div>
  <div>
    {#if operation.kind === "flow"}
      <TxBlockFlowEditor
        {operation}
        {onChange}
        {validationErrors}
        pathPrefix={`${pathPrefix}.flow`}
        booleanRows={editorDisplay.booleanRows}
        jsonValueTypeRows={editorDisplay.jsonValueTypeRows}
      />
    {:else if operation.kind === "template"}
      <TxBlockTemplateEditor
        {operation}
        {onChange}
        {validationErrors}
        pathPrefix={`${pathPrefix}.template`}
        booleanRows={editorDisplay.booleanRows}
        jsonValueTypeRows={editorDisplay.jsonValueTypeRows}
        templateVarTypeRows={editorDisplay.templateVarTypeRows}
      />
    {:else}
      <TxBlockCommandEditor
        command={operation.command}
        metadataFieldDefs={commandMetadataFieldDefs}
        onChange={operationActionHandlers.setCommand}
        {validationErrors}
        pathPrefix={`${pathPrefix}.command`}
        jsonValueTypeRows={editorDisplay.jsonValueTypeRows}
      />
    {/if}
  </div>
</div>

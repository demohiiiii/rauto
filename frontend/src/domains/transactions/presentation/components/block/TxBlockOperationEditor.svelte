<script lang="ts">
  import * as Tabs from "$lib/components/ui/tabs/index.js";
  import TxBlockCommandEditor from "$domains/transactions/presentation/components/block/TxBlockCommandEditor.svelte";
  import TxBlockFlowEditor from "$domains/transactions/presentation/components/block/TxBlockFlowEditor.svelte";
  import { t } from "$lib/i18n.js";
  import { createTxBlockOperationEditorWorkspace } from "$domains/transactions/index.js";
  import type {
    txBlockVisualEditorDisplay,
    TxMetadataFieldDefinition,
    TxOperationModel,
    TxValidationError,
  } from "$domains/transactions/index.js";

  interface Props {
    commandMetadataFieldDefs?: readonly TxMetadataFieldDefinition[];
    editorDisplay: ReturnType<typeof txBlockVisualEditorDisplay>;
    onChange?: (operation: TxOperationModel) => void;
    operation: TxOperationModel;
    pathPrefix?: string;
    title: string;
    validationErrors?: readonly TxValidationError[];
  }

  let {
    operation,
    title,
    editorDisplay,
    commandMetadataFieldDefs = [],
    onChange,
    validationErrors = [],
    pathPrefix = "",
  }: Props = $props();
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

<div class="grid gap-4">
  <div class="grid gap-2">
    <h3 class="text-sm font-semibold text-foreground">{title}</h3>
    <Tabs.Root
      value={operation.kind}
      onValueChange={operationActionHandlers.setKind}
      class="w-full"
    >
      <Tabs.List class="grid w-full grid-cols-2" aria-label={title}>
        <Tabs.Trigger value="command">{t("txBlockFormCommand")}</Tabs.Trigger>
        <Tabs.Trigger value="flow">{t("txBlockOperationKindFlow")}</Tabs.Trigger
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
    {:else}
      <TxBlockCommandEditor
        command={operation.command}
        metadataFieldDefs={[...commandMetadataFieldDefs]}
        onChange={operationActionHandlers.setCommand}
        validationErrors={[...validationErrors]}
        pathPrefix={`${pathPrefix}.command`}
        jsonValueTypeRows={editorDisplay.jsonValueTypeRows}
      />
    {/if}
  </div>
</div>

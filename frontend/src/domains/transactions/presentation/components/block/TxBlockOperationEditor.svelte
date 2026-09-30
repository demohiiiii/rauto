<script lang="ts">
  import type { Snippet } from "svelte";
  import ReadonlyFields from "$components/fragments/ReadonlyFields.svelte";
  import * as Tabs from "$lib/components/ui/tabs/index.js";
  import TxBlockCommandEditor from "$domains/transactions/presentation/components/block/TxBlockCommandEditor.svelte";
  import TxBlockInteractiveEditor from "$domains/transactions/presentation/components/block/TxBlockInteractiveEditor.svelte";
  import { t } from "$lib/i18n.js";
  import {
    transactionOperationEditorKind,
    changeTransactionOperationEditorKind,
  } from "../../../model/transactionCommandEditor.js";
  import type {
    txBlockVisualEditorDisplay,
    TxMetadataFieldDefinition,
    TxOperationModel,
    TxValidationError,
  } from "$domains/transactions/index.js";

  interface Props {
    options?: Snippet;
    commandMetadataFieldDefs?: readonly TxMetadataFieldDefinition[];
    editorDisplay: ReturnType<typeof txBlockVisualEditorDisplay>;
    onChange?: (operation: TxOperationModel) => void;
    operation: TxOperationModel;
    pathPrefix?: string;
    title: string;
    validationErrors?: readonly TxValidationError[];
  }

  let {
    options,
    operation,
    title,
    editorDisplay,
    commandMetadataFieldDefs = [],
    onChange,
    validationErrors = [],
    pathPrefix = "",
  }: Props = $props();
  let editorKind = $derived(transactionOperationEditorKind(operation));
  function setOperationKind(kind: string): void {
    if (kind === "command" || kind === "interactive") {
      onChange?.(changeTransactionOperationEditorKind(operation, kind));
    }
  }
</script>

<div class="grid gap-4">
  <div class="grid gap-2">
    <h3 class="text-sm font-semibold text-foreground">{title}</h3>
    {@render options?.()}
    <ReadonlyFields>
      <Tabs.Root
        value={editorKind}
        onValueChange={setOperationKind}
        class="w-full"
      >
        <Tabs.List class="grid w-full grid-cols-2" aria-label={title}>
          <Tabs.Trigger value="command">{t("txBlockFormCommand")}</Tabs.Trigger>
          <Tabs.Trigger value="interactive"
            >{t("txBlockOperationKindInteractive")}</Tabs.Trigger
          >
        </Tabs.List>
      </Tabs.Root>
    </ReadonlyFields>
  </div>
  <div>
    {#if operation.kind === "flow"}
      <TxBlockInteractiveEditor
        {operation}
        {onChange}
        {validationErrors}
        pathPrefix={`${pathPrefix}.flow`}
        jsonValueTypeRows={editorDisplay.jsonValueTypeRows}
      />
    {:else}
      <TxBlockCommandEditor
        command={operation.command}
        metadataFieldDefs={[...commandMetadataFieldDefs]}
        interactive={editorKind === "interactive"}
        onChange={(patch) =>
          onChange?.({
            ...operation,
            commandEditorKind: editorKind,
            command: { ...operation.command, ...patch },
          })}
        validationErrors={[...validationErrors]}
        pathPrefix={`${pathPrefix}.command`}
        jsonValueTypeRows={editorDisplay.jsonValueTypeRows}
      />
    {/if}
  </div>
</div>

<script lang="ts">
  import ReadonlyFields from "$components/fragments/ReadonlyFields.svelte";
  import * as Card from "$lib/components/ui/card";
  import PresenceFieldGrid from "$components/fragments/PresenceFieldGrid.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { createTxWorkflowBlockEditorWorkspace } from "$domains/transactions/index.js";
  import SaveIcon from "@lucide/svelte/icons/save";
  import { t } from "$lib/i18n.js";

  import TxBlockVisualEditor from "$domains/transactions/presentation/components/block/TxBlockVisualEditor.svelte";
  import TxWorkflowTemplateRefEditor from "$domains/transactions/presentation/components/workflow/TxWorkflowTemplateRefEditor.svelte";
  import type {
    TxWorkflowBlockActionHandlers,
    TxWorkflowBlockRow,
    TxWorkflowVisualEditorDisplay,
  } from "$domains/transactions/index.js";

  interface Props {
    blockActionHandlers: TxWorkflowBlockActionHandlers;
    blockRow: TxWorkflowBlockRow;
    editorDisplay: TxWorkflowVisualEditorDisplay;
    embedded?: boolean;
    showRemoveAction?: boolean;
    onSaveAsTemplate?: () => void | Promise<void>;
  }

  let {
    blockRow,
    editorDisplay,
    blockActionHandlers,
    showRemoveAction = true,
    embedded = false,
    onSaveAsTemplate,
  }: Props = $props();

  const txWorkflowBlockEditorWorkspace = createTxWorkflowBlockEditorWorkspace();
  const { editorActionHandlersStateStore, setBlockEditorContext } =
    txWorkflowBlockEditorWorkspace;
  let editorActionHandlers = $derived($editorActionHandlersStateStore);

  $effect(() => {
    setBlockEditorContext({ blockActionHandlers, blockRow });
  });
</script>

<Card.Root size="sm" class="min-w-0 gap-0 overflow-hidden py-0">
  <Card.Header class="border-b bg-muted/15 p-4 sm:p-5">
    <Card.Title>{blockRow.titleText}</Card.Title>
    {#if showRemoveAction}
      <Card.Action>
        <ReadonlyFields>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onclick={blockActionHandlers.remove}
          >
            {t("deleteBtn")}
          </Button>
        </ReadonlyFields>
      </Card.Action>
    {/if}
    {#if onSaveAsTemplate}
      <Card.Action>
        <ReadonlyFields>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onclick={onSaveAsTemplate}
          >
            <SaveIcon data-icon="inline-start" />

            {t("txWorkflowSaveBlockTemplate")}
          </Button>
        </ReadonlyFields>
      </Card.Action>
    {/if}
  </Card.Header>
  <Card.Content class="p-4 sm:p-5">
    <div class="grid gap-4">
      <ReadonlyFields>
        <PresenceFieldGrid
          fieldRows={blockRow.fieldRows}
          itemClass="max-w-xs"
          onValueChange={blockActionHandlers.setSource}
        />
      </ReadonlyFields>

      {#if blockRow.showTemplateRef}
        <ReadonlyFields>
          <TxWorkflowTemplateRefEditor
            templateRef={blockRow.block.templateRef}
            booleanRows={editorDisplay.booleanRows}
            jsonValueTypeRows={editorDisplay.jsonValueTypeRows}
            bindings={editorActionHandlers.templateRefBindings}
          />
        </ReadonlyFields>
      {:else if blockRow.showInlineBlock}
        <TxBlockVisualEditor
          model={blockRow.block.inlineBlock}
          stacked={embedded}
          onChange={blockActionHandlers.updateInlineBlock}
        />
      {/if}
    </div>
  </Card.Content>
</Card.Root>

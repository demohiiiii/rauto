<script>
  import * as Card from "$lib/components/ui/card";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { t } from "../../lib/i18n.js";
  import { createTxWorkflowBlockEditorWorkspace } from "../../modules/transactions/transactionWorkflowEditors.js";

  import TxBlockVisualEditor from "./TxBlockVisualEditor.svelte";
  import TxWorkflowTemplateRefEditor from "./TxWorkflowTemplateRefEditor.svelte";

  let {
    blockRow,
    editorDisplay,
    blockActionHandlers,
    showRemoveAction = true,
    embedded = false,
  } = $props();

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
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onclick={blockActionHandlers.remove}
        >
          {t("deleteBtn")}
        </Button>
      </Card.Action>
    {/if}
  </Card.Header>
  <Card.Content class="p-4 sm:p-5">
    <div class="grid gap-4">
      <PresenceFieldGrid
        fieldRows={blockRow.fieldRows}
        itemClass="max-w-xs"
        onValueChange={blockActionHandlers.setSource}
      />
      {#if blockRow.showTemplateRef}
        <TxWorkflowTemplateRefEditor
          templateRef={blockRow.block.templateRef}
          booleanRows={editorDisplay.booleanRows}
          jsonValueTypeRows={editorDisplay.jsonValueTypeRows}
          bindings={editorActionHandlers.templateRefBindings}
        />
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

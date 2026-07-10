<script>
  import * as Card from "$lib/components/ui/card";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { t } from "../../lib/i18n.js";
  import { createTxWorkflowBlockEditorWorkspace } from "../../modules/transactionWorkflowEditors.js";

  import { txWorkflowInlineCommandMetadataFieldDefs } from "../../modules/transactionStructure.js";
  import TxBlockVisualEditor from "./TxBlockVisualEditor.svelte";
  import TxWorkflowTemplateRefEditor from "./TxWorkflowTemplateRefEditor.svelte";

  const INLINE_BLOCK_RUN_COMMAND_METADATA_FIELD_DEFS =
    txWorkflowInlineCommandMetadataFieldDefs();

  let { blockRow, editorDisplay, blockActionHandlers } = $props();

  const txWorkflowBlockEditorWorkspace = createTxWorkflowBlockEditorWorkspace();
  const { editorActionHandlersStateStore, setBlockEditorContext } =
    txWorkflowBlockEditorWorkspace;
  let editorActionHandlers = $derived($editorActionHandlersStateStore);

  $effect(() => {
    setBlockEditorContext({ blockActionHandlers, blockRow });
  });
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>{blockRow.titleText}</Card.Title>
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
  </Card.Header>
  <Card.Content>
    <div class="grid gap-4">
      <PresenceFieldGrid
        fieldRows={blockRow.fieldRows}
        itemClass="max-w-xs"
        onValueChange={blockActionHandlers.setSource}
      />
      <PresenceFieldGrid
        fieldRows={blockRow.metadataFieldRows || []}
        itemClass="max-w-xs"
        onValueChangeForKey={editorActionHandlers.blockMetadataValueHandler}
        onPresenceChangeForKey={editorActionHandlers.blockMetadataPresenceHandler}
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
          stepRunCommandMetadataFieldDefs={INLINE_BLOCK_RUN_COMMAND_METADATA_FIELD_DEFS}
          onChange={blockActionHandlers.updateInlineBlock}
        />
      {/if}
    </div>
  </Card.Content>
</Card.Root>

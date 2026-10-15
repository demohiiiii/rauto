<script lang="ts">
  import ReadonlyFields from "$components/fragments/ReadonlyFields.svelte";
  import { currentLanguageState } from "$lib/i18n.js";
  import {
    txWorkflowFindBlock,
    txWorkflowBranchModel,
    txWorkflowReplaceBranch,
    txWorkflowVisualEditorDisplay,
    txWorkflowVisualEditorBindings,
  } from "../../../index.js";
  import type {
    TxWorkflowFormModel,
    TransactionWorkflowCanvasWorkspace,
    TransactionBlockTemplateAuthoring,
    TxBlockCommandTarget,
  } from "../../../index.js";
  import TxWorkflowBlockEditor from "./TxWorkflowBlockEditor.svelte";
  import TxWorkflowControlEditor from "./TxWorkflowControlEditor.svelte";

  let {
    model,
    editorId,
    workspace,
    canvasBody = true,
    selectedStepIndex = null,
    selectedOperation = "run",
    readonly = false,
    onChange,
  }: {
    model: TxWorkflowFormModel;
    editorId: string;
    workspace: TransactionWorkflowCanvasWorkspace;
    canvasBody?: boolean;
    selectedStepIndex?: number | null;
    selectedOperation?: TxBlockCommandTarget;
    readonly?: boolean;
    onChange: (model: TxWorkflowFormModel) => void;
  } = $props();
  let selectionStore = $derived(workspace.commandSelectionStateStore);
  let stepSelection = $derived($selectionStore);
  let location = $derived(txWorkflowFindBlock(model, editorId));
  let scope = $derived(
    location
      ? txWorkflowBranchModel(model, location.parentId, location.branch)
      : null,
  );
  let display = $derived.by(() => {
    $currentLanguageState;
    return scope ? txWorkflowVisualEditorDisplay(scope) : null;
  });
  let row = $derived(
    location && display ? display.blockRows[location.blockIndex] : null,
  );
  let bindings = $derived(
    scope && location
      ? txWorkflowVisualEditorBindings(scope, (next) => {
          if (!readonly && location)
            onChange(
              txWorkflowReplaceBranch(
                model,
                location.parentId,
                location.branch,
                next,
              ),
            );
        }).blockBindings(location.blockIndex)
      : null,
  );
  let templateWorkspace = $state.raw<TransactionBlockTemplateAuthoring | null>(
    null,
  );
  $effect(() => {
    templateWorkspace =
      row && !row.block.control
        ? workspace.templates.getWorkspace(row.block)
        : null;
  });
</script>

<ReadonlyFields scopeOnly disabled={readonly}>
  {#if row && bindings && display}
    {#if row.block.control}
      <TxWorkflowControlEditor
        control={row.block.control}
        {canvasBody}
        {readonly}
        onChange={bindings.updateControl}
      />
    {:else if templateWorkspace}
      <TxWorkflowBlockEditor
        blockRow={row}
        editorDisplay={display}
        blockActionHandlers={bindings}
        {templateWorkspace}
        showRemoveAction={false}
        {canvasBody}
        {selectedStepIndex}
        selectedStepPath={stepSelection?.editorId === editorId &&
        stepSelection.path[0] === selectedStepIndex
          ? stepSelection.path
          : null}
        {selectedOperation}
      />
    {/if}
  {/if}
</ReadonlyFields>

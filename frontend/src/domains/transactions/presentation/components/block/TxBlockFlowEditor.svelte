<script lang="ts">
  import { CommandSequenceEditor } from "$domains/command/presentation/components/index.js";
  import PresenceFieldGrid from "$components/fragments/PresenceFieldGrid.svelte";
  import { txBlockCommandDraft } from "$domains/transactions/index.js";
  import { txBlockValidationErrorText } from "$domains/transactions/index.js";
  import { createTxBlockFlowEditorWorkspace } from "$domains/transactions/index.js";
  import type {
    TxCommandModel,
    TxOperationModel,
    TxValidationError,
  } from "$domains/transactions/index.js";

  import TxBlockCommandEditor from "$domains/transactions/presentation/components/block/TxBlockCommandEditor.svelte";

  interface Props {
    booleanRows: readonly string[];
    jsonValueTypeRows: readonly string[];
    onChange?: (operation: TxOperationModel) => void;
    operation: TxOperationModel;
    pathPrefix?: string;
    validationErrors?: readonly TxValidationError[];
  }

  let {
    operation,
    onChange,
    booleanRows,
    jsonValueTypeRows,
    validationErrors = [],
    pathPrefix = "",
  }: Props = $props();
  const txBlockFlowEditorWorkspace = createTxBlockFlowEditorWorkspace();
  const {
    flowActionHandlersStateStore,
    flowFieldRowsStateStore,
    setFlowEditorContext,
  } = txBlockFlowEditorWorkspace;
  let flowActionHandlers = $derived($flowActionHandlersStateStore);
  let flowFieldRows = $derived($flowFieldRowsStateStore);

  $effect(() => {
    setFlowEditorContext({
      operation,
      onChange,
      booleanRows,
      validationErrors,
      pathPrefix,
    });
  });
  let stepsErrorText = $derived(
    txBlockValidationErrorText(validationErrors, `${pathPrefix}.steps`),
  );
</script>

<div class="grid gap-5">
  {#if stepsErrorText}
    <p class="text-xs text-destructive" role="alert">{stepsErrorText}</p>
  {/if}
  <CommandSequenceEditor
    model={operation.flow}
    createStep={txBlockCommandDraft}
    addStepPlacement="footer"
    onChange={(flow) => onChange?.({ ...operation, flow })}
  >
    {#snippet renderSettings()}
      <PresenceFieldGrid
        fieldRows={flowFieldRows}
        valueHandlerMode="event"
        hostClass="grid gap-3 md:grid-cols-2"
        presenceControlsMode="hidden"
        onValueChangeForKey={flowActionHandlers.flowFieldValueHandler}
        onPresenceChangeForKey={flowActionHandlers.flowFieldPresenceHandler}
      />
    {/snippet}
    {#snippet renderStepContent(commandStepRow)}
      <TxBlockCommandEditor
        command={commandStepRow.commandStep}
        onChange={(patch: Partial<TxCommandModel>) =>
          commandStepRow.onChange({ ...commandStepRow.commandStep, ...patch })}
        validationErrors={[...validationErrors]}
        pathPrefix={`${pathPrefix}.steps[${commandStepRow.stepIndex}]`}
        {jsonValueTypeRows}
      />
    {/snippet}
  </CommandSequenceEditor>
</div>

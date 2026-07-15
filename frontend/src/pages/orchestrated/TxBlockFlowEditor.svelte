<script>
  import { CommandFlowTemplateEditor } from "../../components/command-flow/index.js";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import { txBlockCommandDraft } from "../../modules/transactionBlockMutations.js";
  import { txBlockValidationErrorText } from "../../modules/transactionBlockDisplayState.js";
  import { createTxBlockFlowEditorWorkspace } from "../../modules/transactionBlockDisplays.js";

  import TxBlockCommandEditor from "./TxBlockCommandEditor.svelte";

  let {
    operation,
    onChange,
    booleanRows,
    jsonValueTypeRows,
    validationErrors = [],
    pathPrefix = "",
  } = $props();
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
  <CommandFlowTemplateEditor
    model={operation.flow}
    createStep={txBlockCommandDraft}
    showNameField={false}
    showDefaultSettings={false}
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
    {#snippet renderStepContent(flowStepRow)}
      <TxBlockCommandEditor
        command={flowStepRow.flowStep}
        onChange={(patch) =>
          flowStepRow.onChange({ ...flowStepRow.flowStep, ...patch })}
        {validationErrors}
        pathPrefix={`${pathPrefix}.steps[${flowStepRow.stepIndex}]`}
        {jsonValueTypeRows}
      />
    {/snippet}
  </CommandFlowTemplateEditor>
</div>

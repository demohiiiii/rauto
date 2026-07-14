<script>
  import {
    CommandFlowSettings,
    CommandFlowStepsEditor,
  } from "../../components/command-flow/index.js";
  import { t } from "../../lib/i18n.js";
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
    flowStepRowsStateStore,
    setFlowEditorContext,
  } = txBlockFlowEditorWorkspace;
  let flowActionHandlers = $derived($flowActionHandlersStateStore);
  let flowFieldRows = $derived($flowFieldRowsStateStore);
  let flowStepRows = $derived($flowStepRowsStateStore);

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
  <CommandFlowSettings
    title={t("txBlockFormFlowSettings")}
    description={t("txBlockFormFlowSettingsHint")}
    fieldRows={flowFieldRows}
    onValueChangeForKey={flowActionHandlers.flowFieldValueHandler}
    onPresenceChangeForKey={flowActionHandlers.flowFieldPresenceHandler}
  />
  {#if stepsErrorText}
    <p class="text-xs text-destructive" role="alert">{stepsErrorText}</p>
  {/if}
  <CommandFlowStepsEditor
    title={t("txBlockFormFlowSteps")}
    description={t("txBlockFormFlowStepsHint")}
    addLabel={t("txBlockFormAddFlowStep")}
    emptyText={t("txBlockFormFlowStepsEmpty")}
    removeLabel={t("deleteBtn")}
    duplicateLabel={t("txBlockTimelineDuplicateStep")}
    moveUpLabel={t("txBlockTimelineMoveUp")}
    moveDownLabel={t("txBlockTimelineMoveDown")}
    stepRows={flowStepRows}
    onAddStep={flowActionHandlers.addStep}
    onRemoveStep={flowActionHandlers.removeStep}
    onDuplicateStep={flowActionHandlers.duplicateStep}
    onMoveStep={flowActionHandlers.moveStep}
  >
    {#snippet renderStep(flowStepRow)}
      <TxBlockCommandEditor
        command={flowStepRow.flowStep}
        onChange={flowActionHandlers.stepChangeHandler(flowStepRow.stepIndex)}
        {validationErrors}
        pathPrefix={`${pathPrefix}.steps[${flowStepRow.stepIndex}]`}
        {jsonValueTypeRows}
      />
    {/snippet}
  </CommandFlowStepsEditor>
</div>

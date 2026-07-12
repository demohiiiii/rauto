<script>
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { t } from "../../lib/i18n.js";
  import { txBlockValidationErrorText } from "../../modules/transactionBlockDisplayState.js";
  import { createTxBlockFlowEditorWorkspace } from "../../modules/transactionBlockDisplays.js";

  import {
    txBlockFlowMetadataFieldDefs,
    txBlockFlowStepMetadataFieldDefs,
  } from "../../modules/transactionStructure.js";
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
    flowMetadataFieldRowsStateStore,
    flowStepRowsStateStore,
    setFlowEditorContext,
  } = txBlockFlowEditorWorkspace;
  let flowActionHandlers = $derived($flowActionHandlersStateStore);
  let flowFieldRows = $derived($flowFieldRowsStateStore);
  let flowMetadataFieldRows = $derived($flowMetadataFieldRowsStateStore);
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

<div class="grid gap-3">
  <div class="grid gap-3 md:grid-cols-3">
    <PresenceFieldGrid
      fieldRows={flowFieldRows}
      valueHandlerMode="event"
      hostClass="contents"
      presenceControlsMode="hidden"
      onValueChangeForKey={flowActionHandlers.flowFieldValueHandler}
      onPresenceChangeForKey={flowActionHandlers.flowFieldPresenceHandler}
    />
    <PresenceFieldGrid
      fieldRows={flowMetadataFieldRows}
      valueHandlerMode="event"
      hostClass="contents"
      presenceControlsMode="hidden"
      onValueChangeForKey={flowActionHandlers.metadataValueHandler}
      onPresenceChangeForKey={flowActionHandlers.metadataPresenceHandler}
    />
  </div>
  <JsonObjectFieldsEditor
    title={t("txBlockFormFlowExtra")}
    source={operation.flow.extra}
    typeRows={jsonValueTypeRows}
    onChange={flowActionHandlers.setExtra}
  />
  <div class="flex flex-wrap items-center justify-between gap-3">
    <span>{t("txBlockFormFlowSteps")}</span>
    <Button size="sm" type="button" onclick={flowActionHandlers.addStep}>
      {t("txBlockFormAddFlowStep")}
    </Button>
  </div>
  {#if stepsErrorText}
    <p class="text-xs text-destructive" role="alert">{stepsErrorText}</p>
  {/if}
  {#each flowStepRows as flowStepRow (flowStepRow.stepIndex)}
    <div class="rounded-lg border border-border p-3">
      <div class="mb-3 flex items-center justify-between">
        <span class="text-xs font-semibold text-muted-foreground">
          {flowStepRow.titleText}
        </span>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onclick={flowActionHandlers.removeStepHandler(flowStepRow.stepIndex)}
        >
          {t("deleteBtn")}
        </Button>
      </div>
      <TxBlockCommandEditor
        command={flowStepRow.flowStep}
        metadataFieldDefs={txBlockFlowStepMetadataFieldDefs()}
        onChange={flowActionHandlers.stepChangeHandler(flowStepRow.stepIndex)}
        {validationErrors}
        pathPrefix={`${pathPrefix}.steps[${flowStepRow.stepIndex}]`}
        {jsonValueTypeRows}
      />
    </div>
  {/each}
</div>

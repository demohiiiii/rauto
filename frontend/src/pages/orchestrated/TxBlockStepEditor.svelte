<script>
  import ListChecksIcon from "@lucide/svelte/icons/list-checks";
  import * as Card from "$lib/components/ui/card";
  import PlainCheckboxField from "../../components/fragments/PlainCheckboxField.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import { t } from "../../lib/i18n.js";
  import TxBlockOperationEditor from "./TxBlockOperationEditor.svelte";
  import TxFormSection from "./TxFormSection.svelte";
  import { createTxBlockStepEditorWorkspace } from "../../modules/transactionBlockDisplays.js";

  let {
    step,
    titleText,
    editorDisplay,
    runCommandMetadataFieldDefs = [],
    rollbackCommandMetadataFieldDefs = [],
    perStepRollbackEnabled = false,
    onRunChange,
    onRollbackChange,
    onRollbackEnabledChange,
    onStepChange,
    validationErrors = [],
    pathPrefix = "",
  } = $props();

  const txBlockStepEditorWorkspace = createTxBlockStepEditorWorkspace();
  const {
    rollbackEnabledStateStore,
    setStepEditorContext,
    stepActionHandlersStateStore,
    stepFieldRowsStateStore,
  } = txBlockStepEditorWorkspace;
  let rollbackEnabled = $derived($rollbackEnabledStateStore);
  let stepFieldRows = $derived($stepFieldRowsStateStore);
  let stepActionHandlers = $derived($stepActionHandlersStateStore);

  $effect(() => {
    setStepEditorContext({
      step,
      onStepChange,
      validationErrors,
      pathPrefix,
    });
  });
</script>

<Card.Content class="min-w-0 px-0">
  <header class="px-4 pb-4 sm:px-6">
    <h2 class="text-base font-semibold text-foreground">{titleText}</h2>
    <p class="mt-1 text-xs leading-relaxed text-muted-foreground">
      {t("txBlockInspectorStepHint")}
    </p>
  </header>

  <Separator />

  <div class="grid min-w-0 gap-5 px-4 pt-5 sm:px-6">
    <TxBlockOperationEditor
      operation={step.run}
      title={t("txBlockFormRunOperation")}
      {editorDisplay}
      commandMetadataFieldDefs={runCommandMetadataFieldDefs}
      onChange={onRunChange}
      {validationErrors}
      pathPrefix={`${pathPrefix}.run`}
    />

    <Separator />

    {#if perStepRollbackEnabled}
      <TxFormSection
        icon={ListChecksIcon}
        title={t("txBlockFormStepOptions")}
        description={t("txBlockFormStepOptionsHint")}
      >
        <PlainCheckboxField
          controlKind="switch"
          checked={rollbackEnabled}
          labelText={t("txBlockFormEnableStepRollback")}
          onCheckedChange={onRollbackEnabledChange}
        />
        {#if rollbackEnabled}
          <PresenceFieldGrid
            fieldRows={stepFieldRows}
            valueHandlerMode="event"
            hostClass="grid gap-3 md:grid-cols-2"
            presenceControlsMode="hidden"
            onValueChangeForKey={stepActionHandlers.fieldValueHandler}
            onPresenceChangeForKey={stepActionHandlers.fieldPresenceHandler}
          />
        {/if}
      </TxFormSection>
    {/if}

    {#if perStepRollbackEnabled && rollbackEnabled && step.rollback}
      <Separator />
      <TxBlockOperationEditor
        operation={step.rollback}
        title={t("txBlockFormRollbackOperation")}
        {editorDisplay}
        commandMetadataFieldDefs={rollbackCommandMetadataFieldDefs}
        onChange={onRollbackChange}
        {validationErrors}
        pathPrefix={`${pathPrefix}.rollback`}
      />
    {/if}
  </div>
</Card.Content>

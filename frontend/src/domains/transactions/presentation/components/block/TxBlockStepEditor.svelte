<script lang="ts">
  import ReadonlyFields from "$components/fragments/ReadonlyFields.svelte";
  import ListChecksIcon from "@lucide/svelte/icons/list-checks";
  import * as Card from "$lib/components/ui/card";
  import PlainCheckboxField from "$components/fragments/PlainCheckboxField.svelte";
  import PresenceFieldGrid from "$components/fragments/PresenceFieldGrid.svelte";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import { t } from "$lib/i18n.js";
  import TxBlockOperationEditor from "$domains/transactions/presentation/components/block/TxBlockOperationEditor.svelte";
  import TxFormSection from "$domains/transactions/presentation/components/shared/TxFormSection.svelte";
  import { createTxBlockStepEditorWorkspace } from "$domains/transactions/index.js";
  import type {
    txBlockVisualEditorDisplay,
    TxBlockStepChangeHandler,
    TxMetadataFieldDefinition,
    TxOperationModel,
    TxStepFormModel,
    TxValidationError,
  } from "$domains/transactions/index.js";

  interface Props {
    editorDisplay: ReturnType<typeof txBlockVisualEditorDisplay>;
    onRollbackChange?: (operation: TxOperationModel | null) => void;
    onRollbackEnabledChange?: (enabled: boolean) => void;
    onRunChange?: (operation: TxOperationModel) => void;
    onStepChange?: TxBlockStepChangeHandler;
    pathPrefix?: string;
    perStepRollbackEnabled?: boolean;
    rollbackCommandMetadataFieldDefs?: readonly TxMetadataFieldDefinition[];
    runCommandMetadataFieldDefs?: readonly TxMetadataFieldDefinition[];
    step: TxStepFormModel;
    validationErrors?: readonly TxValidationError[];
  }

  let {
    step,
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
  }: Props = $props();

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
    });
  });
</script>

<Card.Content class="min-w-0 px-0 group-data-[size=sm]/card:px-0">
  <div class="grid min-w-0 gap-4 px-3">
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
      <ReadonlyFields>
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
        </TxFormSection>
      </ReadonlyFields>
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
      >
        {#snippet options()}
          <ReadonlyFields>
            <PresenceFieldGrid
              fieldRows={stepFieldRows}
              valueHandlerMode="event"
              hostClass="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-3"
              presenceControlsMode="hidden"
              onValueChangeForKey={stepActionHandlers.fieldValueHandler}
              onPresenceChangeForKey={stepActionHandlers.fieldPresenceHandler}
            />
          </ReadonlyFields>
        {/snippet}
      </TxBlockOperationEditor>
    {/if}
  </div>
</Card.Content>

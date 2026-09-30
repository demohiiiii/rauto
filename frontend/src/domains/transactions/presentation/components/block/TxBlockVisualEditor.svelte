<script lang="ts">
  import { getContext } from "svelte";
  import { readonlyFieldsContextKey } from "$lib/svelte.js";
  import * as Card from "$lib/components/ui/card";
  import { currentLanguageState } from "$lib/i18n.js";
  import TxBlockRootInspector from "$domains/transactions/presentation/components/block/TxBlockRootInspector.svelte";
  import TxBlockStepEditor from "$domains/transactions/presentation/components/block/TxBlockStepEditor.svelte";
  import TxBlockTimeline from "$domains/transactions/presentation/components/block/TxBlockTimeline.svelte";
  import { createTxBlockVisualEditorWorkspace } from "$domains/transactions/index.js";
  import type {
    TxBlockFormModel,
    TxMetadataFieldDefinition,
  } from "$domains/transactions/index.js";

  interface Props {
    model: TxBlockFormModel;
    onChange?: (model: TxBlockFormModel) => void;
    stepRollbackCommandMetadataFieldDefs?:
      readonly TxMetadataFieldDefinition[] | null;
    stepRunCommandMetadataFieldDefs?:
      readonly TxMetadataFieldDefinition[] | null;
  }

  let {
    model,
    onChange,
    stepRunCommandMetadataFieldDefs = null,
    stepRollbackCommandMetadataFieldDefs = null,
  }: Props = $props();

  const txBlockVisualEditorWorkspace = createTxBlockVisualEditorWorkspace();
  const {
    editorActionHandlersStateStore,
    editorDisplayStateStore,
    addAndSelectStep,
    duplicateSelectedStep,
    moveSelectedStep,
    removeSelectedStep,
    rollbackPanelStateStore,
    rootPanelStateStore,
    selectedTargetStateStore,
    selectStep,
    setVisualEditorContext,
    stepsPanelStateStore,
    timelineDisplayStateStore,
    validationErrorsStateStore,
  } = txBlockVisualEditorWorkspace;

  let editorDisplay = $derived($editorDisplayStateStore);
  let editorActionHandlers = $derived($editorActionHandlersStateStore);
  let rootPanel = $derived($rootPanelStateStore);
  let rollbackPanel = $derived($rollbackPanelStateStore);
  let selectedTarget = $derived($selectedTargetStateStore);
  let stepsPanel = $derived($stepsPanelStateStore);
  let timelineDisplay = $derived($timelineDisplayStateStore);
  let validationErrors = $derived($validationErrorsStateStore);
  let currentLanguage = $derived($currentLanguageState);
  let selectedStepRow = $derived(
    selectedTarget.kind === "step"
      ? stepsPanel.stepRows.find(
          (stepRow) => stepRow.stepIndex === selectedTarget.stepIndex,
        ) || null
      : null,
  );

  const inheritedReadonly = getContext<(() => boolean) | undefined>(
    readonlyFieldsContextKey,
  );
  $effect(() => {
    setVisualEditorContext({
      model,
      onChange: (nextModel) => {
        if (!inheritedReadonly?.()) onChange?.(nextModel);
      },
    });
  });
</script>

<div data-testid="tx-block-editor-layout" class="grid min-w-0 gap-4">
  <TxBlockRootInspector
    {editorDisplay}
    {editorActionHandlers}
    {rootPanel}
    {rollbackPanel}
    {validationErrors}
    pathPrefix=""
  />

  <div class="min-w-0">
    <TxBlockTimeline
      display={timelineDisplay}
      {selectStep}
      addStep={addAndSelectStep}
      {duplicateSelectedStep}
      {moveSelectedStep}
      {removeSelectedStep}
    />
  </div>

  {#key currentLanguage}
    {#if selectedStepRow}
      <Card.Root size="sm" class="min-w-0">
        {@const stepRow = selectedStepRow}
        <TxBlockStepEditor
          step={stepRow.step}
          {editorDisplay}
          {validationErrors}
          pathPrefix={`steps[${stepRow.stepIndex}]`}
          runCommandMetadataFieldDefs={stepRunCommandMetadataFieldDefs || []}
          rollbackCommandMetadataFieldDefs={stepRollbackCommandMetadataFieldDefs ||
            []}
          perStepRollbackEnabled={model.rollbackPolicy?.kind === "per_step"}
          onRunChange={editorActionHandlers.stepRunChangeAction(
            stepRow.stepIndex,
          )}
          onRollbackChange={editorActionHandlers.stepRollbackChangeAction(
            stepRow.stepIndex,
          )}
          onRollbackEnabledChange={editorActionHandlers.stepRollbackEnabledAction(
            stepRow.stepIndex,
          )}
          onStepChange={editorActionHandlers.stepChangeAction(
            stepRow.stepIndex,
          )}
        />
      </Card.Root>
    {/if}
  {/key}
</div>

<script>
  import * as Card from "$lib/components/ui/card";
  import { currentLanguageState, t } from "../../lib/i18n.js";
  import TxBlockRootInspector from "./TxBlockRootInspector.svelte";
  import TxBlockStepEditor from "./TxBlockStepEditor.svelte";
  import TxBlockTimeline from "./TxBlockTimeline.svelte";
  import { createTxBlockVisualEditorWorkspace } from "../../modules/transactionBlockDisplays.js";

  let {
    model,
    onChange,
    stepRunCommandMetadataFieldDefs = null,
    stepRollbackCommandMetadataFieldDefs = null,
  } = $props();

  const txBlockVisualEditorWorkspace = createTxBlockVisualEditorWorkspace();
  const {
    editorActionHandlersStateStore,
    editorDisplayStateStore,
    editorSummaryStateStore,
    addAndSelectStep,
    duplicateSelectedStep,
    moveSelectedStep,
    removeSelectedStep,
    rollbackPanelStateStore,
    rootPanelStateStore,
    selectedTargetStateStore,
    selectRoot,
    selectStep,
    setVisualEditorContext,
    stepsPanelStateStore,
    timelineDisplayStateStore,
    validationErrorsStateStore,
  } = txBlockVisualEditorWorkspace;

  let editorDisplay = $derived($editorDisplayStateStore);
  let editorActionHandlers = $derived($editorActionHandlersStateStore);
  let editorSummary = $derived($editorSummaryStateStore);
  let rootPanel = $derived($rootPanelStateStore);
  let rollbackPanel = $derived($rollbackPanelStateStore);
  let selectedTarget = $derived($selectedTargetStateStore);
  let stepsPanel = $derived($stepsPanelStateStore);
  let timelineDisplay = $derived({
    ...$timelineDisplayStateStore,
    rootSelected: selectedTarget.kind === "root",
  });
  let validationErrors = $derived($validationErrorsStateStore);
  let currentLanguage = $derived($currentLanguageState);
  let selectedStepRow = $derived(
    selectedTarget.kind === "step"
      ? stepsPanel.stepRows.find(
          (stepRow) => stepRow.stepIndex === selectedTarget.stepIndex,
        ) || null
      : null,
  );

  $effect(() => {
    setVisualEditorContext({ model, onChange });
  });
</script>

<div class="grid min-w-0 gap-4">
  <button
    type="button"
    class="grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-border bg-muted/30 p-4 text-left transition-colors hover:bg-muted/50 sm:grid-cols-4"
    title={t("txBlockSummaryEditSettings")}
    onclick={selectRoot}
  >
    {#each editorSummary.cellRows as cellRow}
      <span class="min-w-0">
        <span class="block text-xs text-muted-foreground">
          {cellRow.labelText}
        </span>
        <span class="mt-0.5 block truncate text-sm font-medium text-foreground">
          {cellRow.valueText}
        </span>
      </span>
    {/each}
  </button>

  <div
    data-testid="tx-block-editor-layout"
    class="grid min-w-0 gap-4 lg:grid-cols-[minmax(18rem,34%)_minmax(0,66%)] lg:gap-0"
  >
    <div class="min-w-0 lg:pr-4">
      <TxBlockTimeline
        display={timelineDisplay}
        {selectRoot}
        {selectStep}
        addStep={addAndSelectStep}
        {duplicateSelectedStep}
        {moveSelectedStep}
        {removeSelectedStep}
      />
    </div>

    {#key currentLanguage}
      <Card.Root size="sm" class="min-w-0">
        {#if selectedTarget.kind === "root" || !selectedStepRow}
          <TxBlockRootInspector
            {editorDisplay}
            {editorActionHandlers}
            {rootPanel}
            {rollbackPanel}
            {validationErrors}
            pathPrefix=""
          />
        {:else}
          {@const stepRow = selectedStepRow}
          <TxBlockStepEditor
            step={stepRow.step}
            titleText={stepRow.titleText}
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
        {/if}
      </Card.Root>
    {/key}
  </div>
</div>

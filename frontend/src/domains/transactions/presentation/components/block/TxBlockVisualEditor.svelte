<script lang="ts">
  import { txStepAtPath } from "../../../model/transactionStepTree.js";
  import { getContext } from "svelte";
  import { readonlyFieldsContextKey } from "$lib/svelte.js";
  import { currentLanguageState } from "$lib/i18n.js";
  import TxStepControlEditor from "./TxStepControlEditor.svelte";
  import TxBlockRootInspector from "$domains/transactions/presentation/components/block/TxBlockRootInspector.svelte";
  import TxBlockStepEditor from "$domains/transactions/presentation/components/block/TxBlockStepEditor.svelte";
  import TxBlockTimeline from "$domains/transactions/presentation/components/block/TxBlockTimeline.svelte";
  import TxBlockOperationEditor from "./TxBlockOperationEditor.svelte";
  import { createTxBlockVisualEditorWorkspace } from "$domains/transactions/index.js";
  import type {
    TxBlockFormModel,
    TxMetadataFieldDefinition,
    TxBlockCommandTarget,
    TxStepPath,
  } from "$domains/transactions/index.js";
  import { t } from "$lib/i18n.js";

  interface Props {
    model: TxBlockFormModel;
    canvasBody?: boolean;
    bodyOnly?: boolean;
    selectedStepPath?: TxStepPath | null;
    selectedStepIndex?: number | null;
    selectedOperation?: TxBlockCommandTarget;
    onChange?: (model: TxBlockFormModel) => void;
    stepRollbackCommandMetadataFieldDefs?:
      readonly TxMetadataFieldDefinition[] | null;
    stepRunCommandMetadataFieldDefs?:
      readonly TxMetadataFieldDefinition[] | null;
  }

  let {
    model,
    canvasBody = false,
    bodyOnly = false,
    selectedStepPath = null,
    selectedStepIndex = null,
    selectedOperation = "run",
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
  let effectiveStepPath = $derived(
    selectedStepPath && txStepAtPath(model, selectedStepPath)
      ? selectedStepPath
      : null,
  );
  let selectedStepRow = $derived(
    (canvasBody ? selectedStepIndex !== null : selectedTarget.kind === "step")
      ? stepsPanel.stepRows.find(
          (stepRow) =>
            stepRow.stepIndex ===
            (canvasBody ? selectedStepIndex : selectedTarget.stepIndex),
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
  {#if !bodyOnly && (!canvasBody || (selectedStepIndex === null && selectedOperation !== "whole_resource_rollback"))}
    <TxBlockRootInspector
      {editorDisplay}
      {editorActionHandlers}
      {rootPanel}
      {rollbackPanel}
      {validationErrors}
      pathPrefix=""
      showWholeResourceCommand={!canvasBody}
    />
  {/if}

  {#if !canvasBody}
    <div class="min-w-0">
      <TxBlockTimeline
        display={timelineDisplay}
        {selectStep}
        addStep={() => addAndSelectStep()}
        addControl={(kind) => addAndSelectStep(kind)}
        {duplicateSelectedStep}
        {moveSelectedStep}
        {removeSelectedStep}
      />
    </div>
  {/if}

  {#key currentLanguage}
    {#if canvasBody && selectedOperation === "whole_resource_rollback" && rollbackPanel.showWholeResource}
      <section
        class="tx-whole-rollback-editor min-w-0 rounded-lg border border-amber-500/25 bg-amber-500/5 p-4"
      >
        <TxBlockOperationEditor
          operation={rollbackPanel.wholeResourceRollback}
          title={t("txBlockFormWholeRollback")}
          {editorDisplay}
          commandMetadataFieldDefs={[]}
          onChange={editorActionHandlers.setWholeResourceRollback}
          {validationErrors}
          pathPrefix="rollbackPolicy.wholeResource.rollback"
        />
      </section>
    {:else if selectedStepRow}
      {@const stepRow = selectedStepRow}
      {#if stepRow.step.control}
        <TxStepControlEditor
          control={stepRow.step.control}
          parent={model}
          {canvasBody}
          selectedPath={canvasBody ? effectiveStepPath?.slice(1) : null}
          {selectedOperation}
          onChange={(control) =>
            editorActionHandlers.stepChangeAction(stepRow.stepIndex)({
              ...stepRow.step,
              control,
            })}
        />
      {:else}
        <TxBlockStepEditor
          step={stepRow.step}
          {editorDisplay}
          {validationErrors}
          pathPrefix={`steps[${stepRow.stepIndex}]`}
          runCommandMetadataFieldDefs={stepRunCommandMetadataFieldDefs || []}
          rollbackCommandMetadataFieldDefs={stepRollbackCommandMetadataFieldDefs ||
            []}
          perStepRollbackEnabled={model.rollbackPolicy?.kind === "per_step"}
          selectedOperation={canvasBody &&
          selectedOperation !== "whole_resource_rollback"
            ? selectedOperation
            : "both"}
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
    {/if}
  {/key}
</div>

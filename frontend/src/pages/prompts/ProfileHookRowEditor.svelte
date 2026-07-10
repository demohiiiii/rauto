<script>
  import MiniActionButton from "../../components/fragments/MiniActionButton.svelte";
  import PlainCheckboxField from "../../components/fragments/PlainCheckboxField.svelte";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import PlainTextAreaField from "../../components/fragments/PlainTextAreaField.svelte";
  import ValueLabelSelectField from "../../components/fragments/ValueLabelSelectField.svelte";
  import ValueTextSelectField from "../../components/fragments/ValueTextSelectField.svelte";
  import { createProfileHookRowEditorWorkspace } from "../../modules/profiles.js";
  let {
    modeOptions,
    onAddFlowStep,
    onCommandChange,
    onFlowChange,
    onFlowStepChange,
    onKindChange,
    onRemoveFlowStep,
    onRemoveRow,
    onHookRowChange,
    hookRow,
    rowIndex,
    stateList,
  } = $props();
  function handleAddFlowStep(currentRowIndex) {
    if (typeof onAddFlowStep === "function") {
      return onAddFlowStep(currentRowIndex);
    }
    return undefined;
  }

  function handleCommandChange(currentRowIndex, patch) {
    if (typeof onCommandChange === "function") {
      return onCommandChange(currentRowIndex, patch);
    }
    return undefined;
  }

  function handleFlowChange(currentRowIndex, patch) {
    if (typeof onFlowChange === "function") {
      return onFlowChange(currentRowIndex, patch);
    }
    return undefined;
  }

  function handleFlowStepChange(currentRowIndex, stepIndex, patch) {
    if (typeof onFlowStepChange === "function") {
      return onFlowStepChange(currentRowIndex, stepIndex, patch);
    }
    return undefined;
  }

  function handleKindChange(currentRowIndex, hookKind) {
    if (typeof onKindChange === "function") {
      return onKindChange(currentRowIndex, hookKind);
    }
    return undefined;
  }

  function handleRemoveFlowStep(currentRowIndex, stepIndex) {
    if (typeof onRemoveFlowStep === "function") {
      return onRemoveFlowStep(currentRowIndex, stepIndex);
    }
    return undefined;
  }

  function handleRemoveRow(currentRowIndex) {
    if (typeof onRemoveRow === "function") {
      return onRemoveRow(currentRowIndex);
    }
    return undefined;
  }

  function handleHookRowChange(currentRowIndex, patch) {
    if (typeof onHookRowChange === "function") {
      return onHookRowChange(currentRowIndex, patch);
    }
    return undefined;
  }

  const profileHookRowWorkspace = createProfileHookRowEditorWorkspace({
    onAddFlowStep: handleAddFlowStep,
    onCommandChange: handleCommandChange,
    onFlowChange: handleFlowChange,
    onFlowStepChange: handleFlowStepChange,
    onKindChange: handleKindChange,
    onRemoveFlowStep: handleRemoveFlowStep,
    onRemoveRow: handleRemoveRow,
    onHookRowChange: handleHookRowChange,
  });
  const {
    addFlowStepHandler,
    commandModeChangeHandler,
    commandTextChangeHandler,
    commandTimeoutChangeHandler,
    editorDisplayStateStore,
    flowDisplayStateStore,
    flowMaxStepsChangeHandler,
    flowStepCommandChangeHandler,
    flowStepModeChangeHandler,
    flowStepsDisplayStateStore,
    flowStepTimeoutChangeHandler,
    flowStopOnErrorChangeHandler,
    hookFailurePolicyChangeHandler,
    hookNameChangeHandler,
    hookRecordOutputChangeHandler,
    hookStateChangeHandler,
    kindChangeHandler,
    operationDisplayStateStore,
    removeFlowStepHandler,
    removeRowHandler,
    setRowContext,
  } = profileHookRowWorkspace;
  let derivedEditorDisplayStateStore = $derived(editorDisplayStateStore);
  let derivedOperationDisplayStateStore = $derived(operationDisplayStateStore);
  let derivedFlowDisplayStateStore = $derived(flowDisplayStateStore);
  let derivedFlowStepsDisplayStateStore = $derived(flowStepsDisplayStateStore);
  let editorDisplay = $derived($derivedEditorDisplayStateStore);
  let hookDisplay = $derived(editorDisplay.hookDisplay);
  let operationDisplay = $derived($derivedOperationDisplayStateStore);
  let flowDisplay = $derived($derivedFlowDisplayStateStore);
  let flowStepsDisplay = $derived($derivedFlowStepsDisplayStateStore);

  $effect(() => {
    setRowContext({
      hookRow,
      modeOptions,
      rowIndex,
    });
  });
</script>

{#snippet hookFlowStep(hookFlowStepRow)}
  <div class="grid gap-2 md:grid-cols-[160px_1fr_120px_auto]">
    <ValueTextSelectField
      title={flowStepsDisplay.modeLabel}
      value={hookFlowStepRow.mode}
      optionRows={hookFlowStepRow.modeOptionRows}
      onValueChange={flowStepModeChangeHandler(hookFlowStepRow.stepIndex)}
    />
    <PlainTextAreaField
      class="min-h-16 font-mono"
      placeholder={flowStepsDisplay.commandPlaceholder}
      value={hookFlowStepRow.command}
      onValueInput={flowStepCommandChangeHandler(hookFlowStepRow.stepIndex)}
    />
    <PlainInputField
      value={hookFlowStepRow.timeout}
      placeholderText={flowStepsDisplay.timeoutPlaceholder}
      type="number"
      min="1"
      step="1"
      onValueInput={flowStepTimeoutChangeHandler(hookFlowStepRow.stepIndex)}
    />
    <div class="flex items-start justify-end">
      <MiniActionButton
        labelText={flowStepsDisplay.deleteButtonLabel}
        variant="delete"
        onClick={removeFlowStepHandler(hookFlowStepRow.stepIndex)}
      />
    </div>
  </div>
{/snippet}

<div class="grid gap-2 rounded-lg border border-border bg-muted/40 p-3">
  <div class="grid gap-2 md:grid-cols-4">
    {#if stateList}
      <ValueTextSelectField
        title={editorDisplay.stateLabel}
        aria-label={editorDisplay.stateLabel}
        value={hookDisplay.state}
        optionRows={editorDisplay.stateModeOptionRows}
        onValueChange={hookStateChangeHandler()}
      />
    {/if}
    <PlainInputField
      value={hookDisplay.name}
      placeholderText={editorDisplay.namePlaceholder}
      onValueInput={hookNameChangeHandler()}
    />
    <ValueLabelSelectField
      title={editorDisplay.failurePolicyLabel}
      value={hookDisplay.failurePolicy}
      optionRows={editorDisplay.failurePolicyRows}
      onValueChange={hookFailurePolicyChangeHandler()}
    />
    <div class="flex items-start justify-end">
      <MiniActionButton
        labelText={editorDisplay.deleteButtonLabel}
        variant="delete"
        onClick={removeRowHandler()}
      />
    </div>
  </div>
  <PlainCheckboxField
    checked={hookDisplay.recordOutput}
    labelText={editorDisplay.recordOutputLabel}
    onCheckedChange={hookRecordOutputChangeHandler()}
  />
  <ValueLabelSelectField
    title={operationDisplay.kindLabel}
    value={operationDisplay.selectedKind}
    optionRows={operationDisplay.kindOptionRows}
    onValueChange={kindChangeHandler()}
  />

  {#if operationDisplay.showCommandEditor}
    <div class="grid gap-2 md:grid-cols-[160px_1fr_120px]">
      <ValueTextSelectField
        title={operationDisplay.commandModeLabel}
        value={operationDisplay.commandDisplay.mode}
        optionRows={operationDisplay.commandModeOptionRows}
        onValueChange={commandModeChangeHandler()}
      />
      <PlainTextAreaField
        class="min-h-20 font-mono"
        placeholder={operationDisplay.commandPlaceholder}
        value={operationDisplay.commandDisplay.commandText}
        onValueInput={commandTextChangeHandler()}
      />
      <PlainInputField
        value={operationDisplay.commandDisplay.timeoutValue}
        placeholderText={operationDisplay.timeoutPlaceholder}
        type="number"
        min="1"
        step="1"
        onValueInput={commandTimeoutChangeHandler()}
      />
    </div>
  {:else if operationDisplay.showFlowEditor}
    <div class="grid gap-2">
      <div class="grid gap-2 md:grid-cols-[auto_auto_1fr] md:items-center">
        <PlainCheckboxField
          checked={flowDisplay.stopOnError}
          labelText={flowDisplay.stopOnErrorLabel}
          onCheckedChange={flowStopOnErrorChangeHandler()}
        />
        <PlainInputField
          value={flowDisplay.maxSteps}
          placeholderText={flowDisplay.maxStepsPlaceholder}
          type="number"
          min="1"
          step="1"
          onValueInput={flowMaxStepsChangeHandler()}
        />
        <div class="flex justify-end">
          <MiniActionButton
            labelText={flowDisplay.addButtonLabel}
            variant="add"
            onClick={addFlowStepHandler()}
          />
        </div>
      </div>
      <div class="grid gap-2">
        {#each flowStepsDisplay.hookFlowStepRows as hookFlowStepRow}
          {@render hookFlowStep(hookFlowStepRow)}
        {/each}
      </div>
    </div>
  {:else}
    <div class="grid gap-2">
      <div class="text-xs text-slate-500">
        {operationDisplay.unsupportedOperationHint}
        {#if operationDisplay.unsupportedDisplay.hasLabel}
          <span class="ml-1 font-semibold">
            {operationDisplay.unsupportedDisplay.labelText}
          </span>
        {/if}
      </div>
      <PlainTextAreaField
        class="min-h-24 font-mono"
        title={operationDisplay.unsupportedOperationHint}
        value={operationDisplay.unsupportedDisplay.operationText}
        readonly
      />
    </div>
  {/if}
</div>

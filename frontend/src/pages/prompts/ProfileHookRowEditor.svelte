<script>
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";
  import {
    ListChecksIcon,
    PlusIcon,
    TerminalIcon,
    Trash2Icon,
    WorkflowIcon,
  } from "@lucide/svelte";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import PlainTextAreaField from "../../components/fragments/PlainTextAreaField.svelte";
  import ValueLabelSelectField from "../../components/fragments/ValueLabelSelectField.svelte";
  import ValueTextSelectField from "../../components/fragments/ValueTextSelectField.svelte";
  import { createProfileHookRowEditorWorkspace } from "../../modules/profiles/profiles.js";
  import ProfileHookInteractionEditor from "./ProfileHookInteractionEditor.svelte";

  let {
    idPrefix = "profile-hook",
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
    return onAddFlowStep?.(currentRowIndex);
  }

  function handleCommandChange(currentRowIndex, patch) {
    return onCommandChange?.(currentRowIndex, patch);
  }

  function handleFlowChange(currentRowIndex, patch) {
    return onFlowChange?.(currentRowIndex, patch);
  }

  function handleFlowStepChange(currentRowIndex, stepIndex, patch) {
    return onFlowStepChange?.(currentRowIndex, stepIndex, patch);
  }

  function handleKindChange(currentRowIndex, hookKind) {
    return onKindChange?.(currentRowIndex, hookKind);
  }

  function handleRemoveFlowStep(currentRowIndex, stepIndex) {
    return onRemoveFlowStep?.(currentRowIndex, stepIndex);
  }

  function handleRemoveRow(currentRowIndex) {
    return onRemoveRow?.(currentRowIndex);
  }

  function handleHookRowChange(currentRowIndex, patch) {
    return onHookRowChange?.(currentRowIndex, patch);
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
    commandInteractionChangeHandler,
    commandTextChangeHandler,
    commandTimeoutChangeHandler,
    editorDisplayStateStore,
    flowDisplayStateStore,
    flowMaxStepsChangeHandler,
    flowStepCommandChangeHandler,
    flowStepInteractionChangeHandler,
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
  let fieldIdPrefix = $derived(`${idPrefix}-${rowIndex}`);
  let selectedKindLabel = $derived(
    operationDisplay.kindOptionRows.find(
      (option) => option.value === operationDisplay.selectedKind,
    )?.label || operationDisplay.kindLabel,
  );

  function changeOperationKind(nextKind) {
    if (nextKind !== "command" && nextKind !== "flow") return;
    return kindChangeHandler()(nextKind);
  }

  $effect(() => {
    setRowContext({
      hookRow,
      modeOptions,
      rowIndex,
    });
  });
</script>

{#snippet fieldLabel(labelText)}
  <span class="text-xs font-medium text-foreground">{labelText}</span>
{/snippet}

{#snippet hookFlowStep(hookFlowStepRow)}
  <article class="grid min-w-0 gap-3 rounded-md border border-border p-3">
    <header class="flex min-w-0 items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-2">
        <Badge variant="outline" class="font-mono tabular-nums">
          {hookFlowStepRow.stepIndex + 1}
        </Badge>
        <span class="text-xs font-semibold text-foreground">
          {flowStepsDisplay.stepLabel}
        </span>
      </div>
      <Button
        type="button"
        variant="destructive"
        size="icon-sm"
        aria-label={`${flowStepsDisplay.deleteButtonLabel} ${flowStepsDisplay.stepLabel} ${hookFlowStepRow.stepIndex + 1}`}
        title={`${flowStepsDisplay.deleteButtonLabel} ${flowStepsDisplay.stepLabel} ${hookFlowStepRow.stepIndex + 1}`}
        onclick={removeFlowStepHandler(hookFlowStepRow.stepIndex)}
      >
        <Trash2Icon aria-hidden="true" />
      </Button>
    </header>

    <div
      class="grid min-w-0 gap-3 lg:grid-cols-[minmax(9rem,0.35fr)_minmax(0,1fr)_minmax(7rem,0.28fr)]"
    >
      <div class="grid min-w-0 gap-1.5">
        {@render fieldLabel(flowStepsDisplay.modeLabel)}
        <ValueTextSelectField
          title={flowStepsDisplay.modeLabel}
          aria-label={`${flowStepsDisplay.stepLabel} ${hookFlowStepRow.stepIndex + 1} ${flowStepsDisplay.modeLabel}`}
          value={hookFlowStepRow.mode}
          optionRows={hookFlowStepRow.modeOptionRows}
          onValueChange={flowStepModeChangeHandler(hookFlowStepRow.stepIndex)}
        />
      </div>
      <div class="grid min-w-0 gap-1.5">
        <label
          for={`${fieldIdPrefix}-step-${hookFlowStepRow.stepIndex}-command`}
          class="text-xs font-medium text-foreground"
        >
          {flowStepsDisplay.commandPlaceholder}
        </label>
        <PlainTextAreaField
          id={`${fieldIdPrefix}-step-${hookFlowStepRow.stepIndex}-command`}
          class="min-h-20 resize-y font-mono"
          placeholderText={flowStepsDisplay.commandPlaceholder}
          value={hookFlowStepRow.command}
          onValueInput={flowStepCommandChangeHandler(hookFlowStepRow.stepIndex)}
        />
      </div>
      <div class="grid min-w-0 gap-1.5">
        <label
          for={`${fieldIdPrefix}-step-${hookFlowStepRow.stepIndex}-timeout`}
          class="text-xs font-medium text-foreground"
        >
          {flowStepsDisplay.timeoutPlaceholder}
        </label>
        <PlainInputField
          id={`${fieldIdPrefix}-step-${hookFlowStepRow.stepIndex}-timeout`}
          value={hookFlowStepRow.timeout}
          placeholderText={flowStepsDisplay.timeoutPlaceholder}
          type="number"
          min="1"
          step="1"
          onValueInput={flowStepTimeoutChangeHandler(hookFlowStepRow.stepIndex)}
        />
      </div>
    </div>

    <ProfileHookInteractionEditor
      idPrefix={`${fieldIdPrefix}-step-${hookFlowStepRow.stepIndex}-interaction`}
      interaction={hookFlowStepRow.interaction}
      display={hookFlowStepRow.interactionDisplay}
      onChange={flowStepInteractionChangeHandler(hookFlowStepRow.stepIndex)}
    />
  </article>
{/snippet}

<article
  class="min-w-0 overflow-hidden rounded-lg border border-border bg-background shadow-xs"
>
  <header
    class="flex min-w-0 items-start justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3"
  >
    <div class="min-w-0">
      <div class="flex min-w-0 flex-wrap items-center gap-2">
        <h4 class="break-words text-sm font-semibold text-foreground">
          {hookDisplay.name || editorDisplay.namePlaceholder}
        </h4>
        <Badge variant="secondary">{selectedKindLabel}</Badge>
      </div>
      <p class="mt-1 text-xs leading-5 text-muted-foreground">
        {editorDisplay.description}
      </p>
    </div>
    <Button
      class="shrink-0"
      type="button"
      variant="destructive"
      size="icon-sm"
      aria-label={editorDisplay.deleteButtonLabel}
      title={editorDisplay.deleteButtonLabel}
      onclick={removeRowHandler()}
    >
      <Trash2Icon aria-hidden="true" />
    </Button>
  </header>

  <div class="grid min-w-0 gap-4 p-4">
    <div
      class="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(9rem,0.8fr)_minmax(12rem,1.4fr)_minmax(12rem,1fr)_minmax(12rem,1.1fr)]"
    >
      {#if stateList}
        <div class="grid min-w-0 gap-1.5">
          {@render fieldLabel(editorDisplay.stateLabel)}
          <ValueTextSelectField
            title={editorDisplay.stateLabel}
            aria-label={editorDisplay.stateLabel}
            value={hookDisplay.state}
            optionRows={editorDisplay.stateModeOptionRows}
            onValueChange={hookStateChangeHandler()}
          />
        </div>
      {/if}
      <div class="grid min-w-0 gap-1.5">
        <label
          for={`${fieldIdPrefix}-name`}
          class="text-xs font-medium text-foreground"
        >
          {editorDisplay.namePlaceholder}
        </label>
        <PlainInputField
          id={`${fieldIdPrefix}-name`}
          value={hookDisplay.name}
          placeholderText={editorDisplay.namePlaceholder}
          onValueInput={hookNameChangeHandler()}
        />
      </div>
      <div class="grid min-w-0 gap-1.5">
        {@render fieldLabel(editorDisplay.failurePolicyLabel)}
        <ValueLabelSelectField
          title={editorDisplay.failurePolicyLabel}
          aria-label={editorDisplay.failurePolicyLabel}
          value={hookDisplay.failurePolicy}
          optionRows={editorDisplay.failurePolicyRows}
          onValueChange={hookFailurePolicyChangeHandler()}
        />
      </div>
      <div class="grid min-w-0 gap-1.5">
        {@render fieldLabel(editorDisplay.recordOutputLabel)}
        <div
          class="flex min-h-9 items-center justify-between gap-3 rounded-md border border-border px-3"
        >
          <label
            for={`${fieldIdPrefix}-record-output`}
            class="min-w-0 text-xs text-muted-foreground"
          >
            {editorDisplay.recordOutputLabel}
          </label>
          <Switch
            id={`${fieldIdPrefix}-record-output`}
            checked={hookDisplay.recordOutput}
            aria-label={editorDisplay.recordOutputLabel}
            onCheckedChange={hookRecordOutputChangeHandler()}
          />
        </div>
      </div>
    </div>

    <Separator />

    <section
      class="grid min-w-0 gap-4"
      aria-labelledby={`${fieldIdPrefix}-kind`}
    >
      <div
        class="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
      >
        <div class="min-w-0">
          <h5
            id={`${fieldIdPrefix}-kind`}
            class="text-xs font-semibold text-foreground"
          >
            {operationDisplay.kindLabel}
          </h5>
          <p class="mt-1 text-xs leading-5 text-muted-foreground">
            {operationDisplay.selectedKind === "flow"
              ? operationDisplay.flowDescription
              : operationDisplay.commandDescription}
          </p>
        </div>
        <ToggleGroup.Root
          type="single"
          variant="outline"
          size="sm"
          spacing={2}
          class="grid w-full grid-cols-2 sm:min-w-80"
          value={operationDisplay.selectedKind}
          onValueChange={changeOperationKind}
          aria-labelledby={`${fieldIdPrefix}-kind`}
        >
          <ToggleGroup.Item
            value="command"
            aria-label={operationDisplay.kindOptionRows[0].label}
          >
            <TerminalIcon data-icon="inline-start" aria-hidden="true" />
            {operationDisplay.kindOptionRows[0].label}
          </ToggleGroup.Item>
          <ToggleGroup.Item
            value="flow"
            aria-label={operationDisplay.kindOptionRows[1].label}
          >
            <WorkflowIcon data-icon="inline-start" aria-hidden="true" />
            {operationDisplay.kindOptionRows[1].label}
          </ToggleGroup.Item>
        </ToggleGroup.Root>
      </div>

      {#if operationDisplay.showCommandEditor}
        <div
          class="grid min-w-0 gap-3 rounded-md border border-border bg-muted/20 p-3"
        >
          <div
            class="grid min-w-0 gap-3 lg:grid-cols-[minmax(9rem,0.35fr)_minmax(0,1fr)_minmax(7rem,0.28fr)]"
          >
            <div class="grid min-w-0 gap-1.5">
              {@render fieldLabel(operationDisplay.commandModeLabel)}
              <ValueTextSelectField
                title={operationDisplay.commandModeLabel}
                aria-label={operationDisplay.commandModeLabel}
                value={operationDisplay.commandDisplay.mode}
                optionRows={operationDisplay.commandModeOptionRows}
                onValueChange={commandModeChangeHandler()}
              />
            </div>
            <div class="grid min-w-0 gap-1.5">
              <label
                for={`${fieldIdPrefix}-command`}
                class="text-xs font-medium text-foreground"
              >
                {operationDisplay.commandPlaceholder}
              </label>
              <PlainTextAreaField
                id={`${fieldIdPrefix}-command`}
                class="min-h-20 resize-y font-mono"
                placeholderText={operationDisplay.commandPlaceholder}
                value={operationDisplay.commandDisplay.commandText}
                onValueInput={commandTextChangeHandler()}
              />
            </div>
            <div class="grid min-w-0 gap-1.5">
              <label
                for={`${fieldIdPrefix}-timeout`}
                class="text-xs font-medium text-foreground"
              >
                {operationDisplay.timeoutPlaceholder}
              </label>
              <PlainInputField
                id={`${fieldIdPrefix}-timeout`}
                value={operationDisplay.commandDisplay.timeoutValue}
                placeholderText={operationDisplay.timeoutPlaceholder}
                type="number"
                min="1"
                step="1"
                onValueInput={commandTimeoutChangeHandler()}
              />
            </div>
          </div>
          <ProfileHookInteractionEditor
            idPrefix={`${fieldIdPrefix}-command-interaction`}
            interaction={operationDisplay.commandDisplay.interaction}
            display={operationDisplay.commandDisplay.interactionDisplay}
            onChange={commandInteractionChangeHandler()}
          />
        </div>
      {:else if operationDisplay.showFlowEditor}
        <div class="grid min-w-0 gap-4">
          <section
            class="grid min-w-0 gap-3 rounded-md border border-border bg-muted/20 p-3"
            aria-labelledby={`${fieldIdPrefix}-flow-settings`}
          >
            <h6
              id={`${fieldIdPrefix}-flow-settings`}
              class="text-xs font-semibold text-foreground"
            >
              {flowDisplay.settingsTitle}
            </h6>
            <div class="grid min-w-0 gap-3 md:grid-cols-2">
              <div
                class="flex min-h-16 items-center justify-between gap-4 rounded-md border border-border bg-background px-3 py-2"
              >
                <div class="min-w-0">
                  <label
                    for={`${fieldIdPrefix}-stop-on-error`}
                    class="text-xs font-medium text-foreground"
                  >
                    {flowDisplay.stopOnErrorLabel}
                  </label>
                  <p class="mt-1 text-xs leading-5 text-muted-foreground">
                    {flowDisplay.stopOnErrorDescription}
                  </p>
                </div>
                <Switch
                  id={`${fieldIdPrefix}-stop-on-error`}
                  class="shrink-0"
                  checked={flowDisplay.stopOnError}
                  aria-label={flowDisplay.stopOnErrorLabel}
                  onCheckedChange={flowStopOnErrorChangeHandler()}
                />
              </div>
              <div
                class="grid min-w-0 gap-2 rounded-md border border-border bg-background px-3 py-2"
              >
                <div class="min-w-0">
                  <label
                    for={`${fieldIdPrefix}-max-steps`}
                    class="text-xs font-medium text-foreground"
                  >
                    {flowDisplay.maxStepsPlaceholder}
                  </label>
                  <p class="mt-1 text-xs leading-5 text-muted-foreground">
                    {flowDisplay.maxStepsDescription}
                  </p>
                </div>
                <PlainInputField
                  id={`${fieldIdPrefix}-max-steps`}
                  value={flowDisplay.maxSteps}
                  placeholderText={flowDisplay.maxStepsPlaceholder}
                  type="number"
                  min="1"
                  step="1"
                  onValueInput={flowMaxStepsChangeHandler()}
                />
              </div>
            </div>
          </section>

          <section
            class="grid min-w-0 gap-3"
            aria-labelledby={`${fieldIdPrefix}-flow-steps`}
          >
            <header
              class="flex min-w-0 flex-wrap items-center justify-between gap-3"
            >
              <div class="flex min-w-0 items-center gap-2">
                <ListChecksIcon
                  class="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <h6
                  id={`${fieldIdPrefix}-flow-steps`}
                  class="text-xs font-semibold text-foreground"
                >
                  {flowDisplay.stepsTitle}
                </h6>
                <Badge variant="secondary" class="font-mono tabular-nums">
                  {flowStepsDisplay.hookFlowStepRows.length}
                </Badge>
              </div>
              <Button
                type="button"
                variant="primary-outline"
                size="sm"
                onclick={addFlowStepHandler()}
              >
                <PlusIcon data-icon="inline-start" aria-hidden="true" />
                {flowDisplay.addButtonLabel}
              </Button>
            </header>

            {#if flowStepsDisplay.hookFlowStepRows.length === 0}
              <div
                class="grid min-h-28 place-items-center gap-3 rounded-md border border-dashed border-border px-4 py-6 text-center"
              >
                <p class="text-xs leading-5 text-muted-foreground">
                  {flowDisplay.emptyText}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onclick={addFlowStepHandler()}
                >
                  <PlusIcon data-icon="inline-start" aria-hidden="true" />
                  {flowDisplay.addButtonLabel}
                </Button>
              </div>
            {:else}
              <div class="grid min-w-0 gap-3">
                {#each flowStepsDisplay.hookFlowStepRows as hookFlowStepRow}
                  {@render hookFlowStep(hookFlowStepRow)}
                {/each}
              </div>
            {/if}
          </section>
        </div>
      {/if}
    </section>
  </div>
</article>

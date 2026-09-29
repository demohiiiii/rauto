<script lang="ts">
  import TemplateSourceActions from "$components/fragments/TemplateSourceActions.svelte";
  import TemplateSaveDialog from "$components/fragments/TemplateSaveDialog.svelte";
  import { onDestroy, untrack } from "svelte";
  import { createBatchDeliveryWorkspace } from "../../application/createBatchDeliveryWorkspace.js";
  import BatchDeliveryTargets from "./batch/BatchDeliveryTargets.svelte";
  import SlidersHorizontalIcon from "@lucide/svelte/icons/sliders-horizontal";
  import {
    InteractiveAuthoringViews,
    InteractiveRuntimeFields,
  } from "$domains/command/presentation/components/index.js";
  import ExecutionRunBar from "$components/fragments/ExecutionRunBar.svelte";
  import SessionRetryFields from "$components/fragments/SessionRetryFields.svelte";
  import StatusCard from "$components/fragments/StatusCard.svelte";
  import TemplateSourceField from "$components/fragments/TemplateSourceField.svelte";
  import TextfsmControls from "$components/fragments/TextfsmControls.svelte";
  import { createInteractiveExecutionPanelWorkspace } from "../../application/createStandardExecutionWorkspaces.js";
  import { currentLanguageState, t } from "$lib/i18n.js";

  let { active, batch = false }: { active: boolean; batch?: boolean } =
    $props();
  const batchWorkspace = untrack(() =>
    batch ? createBatchDeliveryWorkspace("interactive") : undefined,
  );
  onDestroy(() => batchWorkspace?.destroy());
  const interactiveExecutionWorkspace =
    createInteractiveExecutionPanelWorkspace(batchWorkspace);
  const {
    changeInteractiveEditorTab,
    changeInteractiveModel,
    changeInteractiveNameDialogValue,
    changeInteractiveTemplateName,
    changeInteractiveTextfsmEnabled,
    changeInteractiveAutoDownloadExcel,
    changeInteractiveAutoDownloadOutput,
    changeInteractiveTextfsmStrictErrors,
    changeInteractiveTextfsmTemplate,
    changeInteractiveRetry,
    changeInteractiveToml,
    changeInteractiveVarValue,
    closeInteractiveNameDialog,
    executeInteractiveExecution,
    interactivePanelDisplayStateStore,
    editInteractiveTemplate,
    cancelInteractiveTemplateEdit,
    copyInteractiveTemplate,
    saveInteractiveTemplate,
    setPanelContext,
    submitInteractiveNameDialog,
  } = interactiveExecutionWorkspace;
  let interactivePanelDisplay = $derived($interactivePanelDisplayStateStore);
  let authoringDisplay = $derived(interactivePanelDisplay.authoringDisplay);
  let interactiveInputDisplay = $derived(
    interactivePanelDisplay.interactiveInputDisplay,
  );
  let interactiveRunButtonDisplay = $derived(
    interactivePanelDisplay.interactiveRunButtonDisplay,
  );
  let interactiveTemplateFields = $derived(
    interactivePanelDisplay.interactiveTemplateFields,
  );
  let interactiveTextfsmFields = $derived(
    interactivePanelDisplay.interactiveTextfsmFields,
  );
  let interactiveVarsDisplay = $derived(
    interactivePanelDisplay.interactiveVarsDisplay,
  );
  let interactiveRetryState = $derived(
    interactivePanelDisplay.interactiveRetryState,
  );
  let nameDialog = $derived(authoringDisplay.nameDialog);
  let authoringBusy = $derived(!!authoringDisplay.loadingAction);
  let studioLabels = $derived.by(() => {
    $currentLanguageState;
    return {
      options: t("interactiveStudioOptions"),
      optionsHint: t("interactiveStudioOptionsHint"),
      sequence: t("interactiveStudioSequence"),
    };
  });
  $effect(() => {
    setPanelContext({ active, interactivePanelDisplay });
  });
</script>

<div
  data-interactive-workbench
  class="interactive-studio grid min-w-0 gap-5 p-4 sm:p-5"
  hidden={!active}
>
  {#if batchWorkspace}
    <BatchDeliveryTargets workspace={batchWorkspace} />
  {/if}

  <TemplateSourceField
    value={interactiveTemplateFields.templateName}
    optionValues={interactiveInputDisplay.templateOptionRows}
    optionDetails={interactiveInputDisplay.templateOptionDetails}
    disabled={authoringBusy}
    onValueChange={changeInteractiveTemplateName}
  >
    {#snippet actions()}
      <TemplateSourceActions
        readonly={authoringDisplay.readonly}
        editing={authoringDisplay.editing}
        builtin={authoringDisplay.selection.kind === "builtin"}
        busy={authoringBusy}
        saving={authoringDisplay.loadingAction.startsWith("save")}
        canSave={authoringDisplay.canSave}
        onEdit={editInteractiveTemplate}
        onCopy={copyInteractiveTemplate}
        onSave={saveInteractiveTemplate}
        onCancel={cancelInteractiveTemplateEdit}
      />
    {/snippet}
  </TemplateSourceField>

  {#if authoringDisplay.errorMessage}
    <StatusCard message={authoringDisplay.errorMessage} tone="error" />
  {/if}
  {#if authoringDisplay.statusMessage}
    <StatusCard
      message={authoringDisplay.statusMessage}
      tone={authoringDisplay.statusTone}
    />
  {/if}

  <div class="interactive-studio-columns grid min-w-0 items-start gap-5">
    <div class="grid min-w-0 gap-4">
      {#if interactiveVarsDisplay.hasFields || interactiveVarsDisplay.errorMessage}
        <div class="rounded-2xl border border-border/80 bg-card p-4 sm:p-5">
          <InteractiveRuntimeFields
            surfaceVariant="section"
            display={{ ...interactiveVarsDisplay, hintText: "" }}
            onFieldValueChange={changeInteractiveVarValue}
          />
        </div>
      {/if}
      <section
        class="min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs"
        aria-label={studioLabels.sequence}
      >
        <InteractiveAuthoringViews
          studio={true}
          loading={authoringDisplay.inspecting}
          disabled={authoringDisplay.readonly || authoringBusy}
          activeTab={authoringDisplay.activeTab}
          ariaLabel={interactiveInputDisplay.workbenchTitleText}
          model={authoringDisplay.model}
          modeOptions={authoringDisplay.modeOptions}
          tomlLabel={interactiveInputDisplay.tomlFieldLabel}
          tomlHint={interactiveInputDisplay.tomlFieldHint}
          tomlText={authoringDisplay.tomlText}
          onSelectTab={changeInteractiveEditorTab}
          onModelChange={changeInteractiveModel}
          onTomlChange={changeInteractiveToml}
        />
      </section>
    </div>

    <fieldset
      disabled={authoringDisplay.readonly || authoringBusy}
      class="grid min-w-0 gap-4 rounded-2xl border border-border/80 bg-muted/20 p-4"
      aria-label={studioLabels.options}
    >
      <header class="flex items-start gap-2.5 px-1 pt-1">
        <SlidersHorizontalIcon class="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <h3 class="text-sm font-semibold">{studioLabels.options}</h3>
          <p class="mt-1 text-xs leading-relaxed text-muted-foreground">
            {studioLabels.optionsHint}
          </p>
        </div>
      </header>
      {#if active}
        <TextfsmControls
          hintKey="textfsmParseHint"
          includeTemplateInput={true}
          onEnabledChange={changeInteractiveTextfsmEnabled}
          onAutoDownloadExcelChange={changeInteractiveAutoDownloadExcel}
          onStrictErrorsChange={changeInteractiveTextfsmStrictErrors}
          onTemplateChange={changeInteractiveTextfsmTemplate}
          textfsmFields={interactiveTextfsmFields}
        />
        <SessionRetryFields
          idPrefix={batch
            ? "batch-interactive-session-retry"
            : "interactive-session-retry"}
          value={interactiveRetryState}
          onChange={changeInteractiveRetry}
        />
      {/if}
    </fieldset>
  </div>

  <ExecutionRunBar
    {active}
    autoDownloadOutput={interactiveTextfsmFields.autoDownloadOutput}
    onAutoDownloadOutputChange={changeInteractiveAutoDownloadOutput}
    buttonLabel={interactiveInputDisplay.executeButtonLabel}
    loading={interactiveRunButtonDisplay.executeLoading}
    disabled={!authoringDisplay.canRun ||
      authoringBusy ||
      !interactivePanelDisplay.interactiveRetryValid}
    onRun={executeInteractiveExecution}
  />
</div>

<TemplateSaveDialog
  open={nameDialog.open}
  value={nameDialog.value}
  error={nameDialog.error}
  busy={authoringBusy}
  onChange={changeInteractiveNameDialogValue}
  onClose={closeInteractiveNameDialog}
  onSave={submitInteractiveNameDialog}
/>

<style>
  .interactive-studio {
    container-type: inline-size;
  }
  @container (min-width: 64rem) {
    .interactive-studio-columns {
      grid-template-columns: minmax(0, 1fr) 22rem;
    }
  }
</style>

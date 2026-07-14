<script>
  import CopyPlusIcon from "@lucide/svelte/icons/copy-plus";
  import FilePlusIcon from "@lucide/svelte/icons/file-plus";
  import PlayIcon from "@lucide/svelte/icons/play";
  import SaveIcon from "@lucide/svelte/icons/save";
  import TerminalIcon from "@lucide/svelte/icons/terminal";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import {
    CommandFlowReadonlyView,
    CommandFlowRuntimeFields,
    CommandFlowSurface,
    CommandFlowTemplateEditor,
    CommandFlowTemplateSource,
  } from "../../components/command-flow/index.js";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import OutputBlock from "../../components/fragments/OutputBlock.svelte";
  import ParsedOutputBlock from "../../components/fragments/ParsedOutputBlock.svelte";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import StringSelectField from "../../components/fragments/StringSelectField.svelte";
  import TabList from "../../components/fragments/TabList.svelte";
  import TextAreaField from "../../components/fragments/TextAreaField.svelte";
  import TextfsmControls from "../../components/fragments/TextfsmControls.svelte";
  import { commandFlowEditorViewTabs } from "../../config/dashboardModes.js";
  import {
    createFlowExecutionPanelWorkspace,
    exportStandardParsedOutputItemExcel,
  } from "../../modules/standard.js";

  let { active } = $props();
  const flowExecutionWorkspace = createFlowExecutionPanelWorkspace();
  const {
    changeFlowEditorTab,
    changeFlowModel,
    changeFlowNameDialogValue,
    changeFlowTemplateName,
    changeFlowTextfsmEnabled,
    changeFlowTextfsmPlatform,
    changeFlowTextfsmStrictErrors,
    changeFlowTextfsmTemplate,
    changeFlowToml,
    changeFlowVarValue,
    closeFlowNameDialog,
    executeFlowExecution,
    flowPanelDisplayStateStore,
    openNewFlowDialog,
    openSaveAsFlowDialog,
    runActionHandlers,
    saveFlowTemplate,
    setPanelContext,
    submitFlowNameDialog,
  } = flowExecutionWorkspace;
  let flowPanelDisplay = $derived($flowPanelDisplayStateStore);
  let authoringDisplay = $derived(flowPanelDisplay.authoringDisplay);
  let commandFlowExecutionDisplay = $derived(
    flowPanelDisplay.executionStatusDisplay,
  );
  let exportLoading = $derived(flowPanelDisplay.exportLoading);
  let flowInputDisplay = $derived(flowPanelDisplay.flowInputDisplay);
  let flowResultPresentation = $derived(flowPanelDisplay.flowResultDisplay);
  let flowRunButtonDisplay = $derived(flowPanelDisplay.flowRunButtonDisplay);
  let flowTemplateFields = $derived(flowPanelDisplay.flowTemplateFields);
  let flowTextfsmFields = $derived(flowPanelDisplay.flowTextfsmFields);
  let flowVarsDisplay = $derived(flowPanelDisplay.flowVarsDisplay);
  let nameDialog = $derived(authoringDisplay.nameDialog);
  let exportResultExcel = $derived(runActionHandlers.export);
  let authoringBusy = $derived(!!authoringDisplay.loadingAction);
  let currentDraftName = $derived(
    authoringDisplay.selection.name || flowInputDisplay.newSourceLabel,
  );
  let currentSourceLabel = $derived(
    authoringDisplay.selection.kind === "builtin"
      ? flowInputDisplay.builtinSourceLabel
      : authoringDisplay.selection.kind === "custom"
        ? flowInputDisplay.customSourceLabel
        : flowInputDisplay.newSourceLabel,
  );
  let nameDialogTitle = $derived(
    nameDialog.action === "new"
      ? flowInputDisplay.nameDialogNewTitle
      : flowInputDisplay.nameDialogSaveAsTitle,
  );
  let flowStepCount = $derived(
    Array.isArray(authoringDisplay.model?.steps)
      ? authoringDisplay.model.steps.length
      : 0,
  );
  let flowVariableCount = $derived(
    Array.isArray(flowVarsDisplay?.fieldRows)
      ? flowVarsDisplay.fieldRows.length
      : 0,
  );

  function handleNameDialogOpenChange(open) {
    if (!open) closeFlowNameDialog();
  }

  function handleNameDialogKeydown(event) {
    if (event.key !== "Enter" || event.isComposing) return;
    event.preventDefault();
    void submitFlowNameDialog();
  }

  $effect(() => {
    setPanelContext({ active, flowPanelDisplay });
  });
</script>

{#snippet flowExecutionResults()}
  {#if commandFlowExecutionDisplay.statusMessage || flowResultPresentation.hasResult}
    <div class="border-t-4 border-muted">
      <CommandFlowSurface
        variant="workbench-header"
        icon={TerminalIcon}
        title={flowInputDisplay.resultsTitleText}
        description={flowInputDisplay.resultsDescriptionText}
      >
        {#if commandFlowExecutionDisplay.statusMessage}
          <StatusCard
            message={commandFlowExecutionDisplay.statusMessage}
            tone={commandFlowExecutionDisplay.statusTone}
          />
        {/if}

        {#if flowResultPresentation.hasResult}
          <StatusCard
            message={flowResultPresentation.resultSummaryMessage}
            tone={flowResultPresentation.resultSummaryTone}
          />
          {#if flowResultPresentation.exportAvailable}
            <div class="flex justify-end">
              <LoadingButton
                variant="outline"
                size="xs"
                loading={exportLoading}
                onclick={exportResultExcel}
              >
                <span>{flowResultPresentation.exportButtonLabel}</span>
              </LoadingButton>
            </div>
          {/if}
          {#if flowResultPresentation.hasResultRows}
            <div class="grid min-w-0 gap-2">
              {#each flowResultPresentation.resultRows as flowResultRow}
                <div
                  class="grid min-w-0 gap-2 rounded-lg border border-border bg-card px-3 py-3"
                >
                  <div
                    class="flex min-w-0 flex-wrap items-center justify-between gap-2"
                  >
                    <span class="text-sm font-semibold text-card-foreground">
                      {flowResultRow.flowRowTitleText}
                    </span>
                    <span class={flowResultRow.flowBadgeClass}>
                      {flowResultRow.statusLabel}
                    </span>
                  </div>
                  <div class="text-xs text-muted-foreground">
                    {flowResultRow.exitCodeMetaText}
                  </div>
                  <OutputBlock>{flowResultRow.outputText}</OutputBlock>
                  {#if flowResultRow.parsedOutputBlock}
                    <ParsedOutputBlock
                      parsedOutputBlock={flowResultRow.parsedOutputBlock}
                      onExportExcel={exportStandardParsedOutputItemExcel}
                    />
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </CommandFlowSurface>
    </div>
  {/if}
{/snippet}

<div
  data-command-flow-workbench
  class="-mx-6 -mb-6 grid min-w-0 overflow-hidden border-t border-border"
  hidden={!active}
>
  <CommandFlowTemplateSource
    surfaceVariant="workbench-header"
    title={flowInputDisplay.workbenchTitleText}
    description={flowInputDisplay.workbenchDescriptionText}
  >
    <div class="flex min-w-0 flex-col gap-3">
      <div
        class="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-1"
      >
        <span class="text-sm font-medium text-foreground">
          {flowInputDisplay.templateTitleText}
        </span>
        <span class="text-xs leading-relaxed text-muted-foreground">
          {flowInputDisplay.templateDescriptionText}
        </span>
      </div>
      <div class="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <StringSelectField
          class="min-w-0 flex-1"
          placeholderText={flowInputDisplay.templateField.placeholder}
          aria-label={flowInputDisplay.templateField.ariaLabelText}
          title={flowInputDisplay.templateField.placeholder}
          value={flowTemplateFields.templateName}
          optionValues={flowInputDisplay.templateOptionRows}
          includeEmptyOption={true}
          disabled={authoringBusy}
          onValueChange={changeFlowTemplateName}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={authoringBusy}
          onclick={openNewFlowDialog}
        >
          <FilePlusIcon data-icon="inline-start" />
          {flowInputDisplay.newButtonLabel}
        </Button>
      </div>

      <div class="flex min-w-0 flex-wrap items-center gap-2 text-sm">
        <span class="text-muted-foreground">
          {flowInputDisplay.currentDraftLabel}
        </span>
        <span class="min-w-0 truncate font-medium text-foreground">
          {currentDraftName}
        </span>
        <Badge
          variant={authoringDisplay.selection.kind === "builtin"
            ? "secondary"
            : "outline"}
        >
          {currentSourceLabel}
        </Badge>
      </div>
      {#if authoringDisplay.errorMessage}
        <StatusCard message={authoringDisplay.errorMessage} tone="error" />
      {:else if authoringDisplay.inspecting}
        <StatusCard message={flowInputDisplay.inspectingText} tone="running" />
      {/if}
      {#if authoringDisplay.statusMessage}
        <StatusCard
          message={authoringDisplay.statusMessage}
          tone={authoringDisplay.statusTone}
        />
      {/if}
    </div>
  </CommandFlowTemplateSource>

  <div
    class="flex min-w-0 flex-wrap items-center gap-2 border-b border-border px-4 py-3 sm:px-6"
  >
    <TabList
      tabItems={commandFlowEditorViewTabs}
      activeValue={authoringDisplay.activeTab}
      aria-label={flowInputDisplay.workbenchTitleText}
      onSelect={changeFlowEditorTab}
    />
  </div>

  {#if authoringDisplay.activeTab === "visual"}
    <CommandFlowTemplateEditor
      model={authoringDisplay.model}
      modeOptions={authoringDisplay.modeOptions}
      showNameField={false}
      surfaceVariant="workbench-section"
      settingsIndexText="01"
      stepsIndexText="02"
      addStepPlacement="footer"
      onChange={changeFlowModel}
    />
  {:else if authoringDisplay.activeTab === "readonly"}
    <CommandFlowReadonlyView model={authoringDisplay.model} />
  {:else}
    <div class="min-w-0 px-4 py-5 sm:px-6">
      <TextAreaField
        class="min-h-[30rem] font-mono text-sm"
        labelText={flowInputDisplay.tomlFieldLabel}
        hintText={flowInputDisplay.tomlFieldHint}
        value={authoringDisplay.tomlText}
        onValueInput={changeFlowToml}
      />
    </div>
  {/if}

  <CommandFlowRuntimeFields
    surfaceVariant="workbench-section"
    indexText="03"
    display={flowVarsDisplay}
    onFieldValueChange={changeFlowVarValue}
  />

  {#if active}
    <CommandFlowSurface
      variant="workbench-section"
      indexText="04"
      title={flowInputDisplay.textfsmTitleText}
      description={flowInputDisplay.textfsmDescriptionText}
    >
      <TextfsmControls
        excelNamePlaceholderKey="batchShowExcelNamePlaceholder"
        hintKey="textfsmParseHint"
        includeTemplateInput={true}
        onEnabledChange={changeFlowTextfsmEnabled}
        onPlatformChange={changeFlowTextfsmPlatform}
        onStrictErrorsChange={changeFlowTextfsmStrictErrors}
        onTemplateChange={changeFlowTextfsmTemplate}
        textfsmFields={flowTextfsmFields}
      />
    </CommandFlowSurface>
  {/if}

  <footer
    class="flex min-w-0 flex-col gap-3 border-t border-border bg-muted/30 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between"
  >
    <p class="text-xs text-muted-foreground">
      <strong class="font-semibold text-foreground">{flowStepCount}</strong>
      {flowInputDisplay.flowStepCountLabel}
      <span aria-hidden="true"> · </span>
      <strong class="font-semibold text-foreground">
        {flowVariableCount}
      </strong>
      {flowInputDisplay.flowVariableCountLabel}
    </p>
    <div class="flex min-w-0 flex-wrap items-center justify-end gap-2">
      <LoadingButton
        variant="outline"
        size="sm"
        loading={authoringDisplay.loadingAction === "save"}
        disabled={!authoringDisplay.canSave || authoringBusy}
        onclick={saveFlowTemplate}
      >
        <SaveIcon data-icon="inline-start" />
        <span>{flowInputDisplay.saveButtonLabel}</span>
      </LoadingButton>
      <Button
        variant="outline"
        size="sm"
        disabled={!authoringDisplay.canSaveAs || authoringBusy}
        onclick={openSaveAsFlowDialog}
      >
        <CopyPlusIcon data-icon="inline-start" />
        {flowInputDisplay.saveAsButtonLabel}
      </Button>
      <LoadingButton
        variant="default"
        size="sm"
        loading={flowRunButtonDisplay.executeLoading}
        disabled={!authoringDisplay.canRun || authoringBusy}
        onclick={executeFlowExecution}
      >
        <PlayIcon data-icon="inline-start" />
        <span>{flowInputDisplay.executeButtonLabel}</span>
      </LoadingButton>
    </div>
  </footer>
  {@render flowExecutionResults()}
</div>

<Dialog.Root open={nameDialog.open} onOpenChange={handleNameDialogOpenChange}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>{nameDialogTitle}</Dialog.Title>
      <Dialog.Description>
        {flowInputDisplay.nameDialogDescription}
      </Dialog.Description>
    </Dialog.Header>

    <PlainInputField
      value={nameDialog.value}
      placeholderText={flowInputDisplay.templateField.placeholder}
      aria-label={nameDialogTitle}
      focus-request-version={nameDialog.open ? 1 : 0}
      select-on-focus-request={true}
      onValueInput={changeFlowNameDialogValue}
      onKeydown={handleNameDialogKeydown}
    />
    {#if nameDialog.errorMessage}
      <StatusCard message={nameDialog.errorMessage} tone="error" />
    {/if}

    <Dialog.Footer>
      <Button variant="outline" onclick={closeFlowNameDialog}>
        {flowInputDisplay.cancelButtonLabel}
      </Button>
      <LoadingButton
        loading={authoringDisplay.loadingAction === "saveAs"}
        disabled={authoringDisplay.loadingAction === "saveAs"}
        onclick={submitFlowNameDialog}
      >
        {flowInputDisplay.nameDialogSubmitLabel}
      </LoadingButton>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

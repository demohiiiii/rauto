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
    CommandFlowAuthoringViews,
    CommandFlowRuntimeFields,
    CommandFlowSurface,
    CommandFlowTemplateSource,
  } from "../../components/command-flow/index.js";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import ExecutionResultMeta from "../../components/fragments/ExecutionResultMeta.svelte";
  import ExecutionResultsPanel from "../../components/fragments/ExecutionResultsPanel.svelte";
  import OutputBlock from "../../components/fragments/OutputBlock.svelte";
  import ParsedOutputBlock from "../../components/fragments/ParsedOutputBlock.svelte";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import SessionRetryFields from "../../components/fragments/SessionRetryFields.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import StringSelectField from "../../components/fragments/StringSelectField.svelte";
  import TextfsmControls from "../../components/fragments/TextfsmControls.svelte";
  import { exportParsedOutputItemExcel } from "../../modules/operations/results.js";
  import { createFlowExecutionPanelWorkspace } from "$domains/standard/index.js";
  import { t } from "../../lib/i18n.js";

  let { active } = $props();
  let activeResultKey = $state("");
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
    changeFlowRetry,
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
  let flowRetryState = $derived(flowPanelDisplay.flowRetryState);
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
  let flowResultItems = $derived(
    flowResultPresentation.resultRows.map((row, index) => ({
      key: `${row.commandText || "step"}:${index}`,
      row,
      title: row.commandText || "-",
      subtitle: row.exitCodeMetaText,
      statusLabel: row.statusLabel,
      statusTone: row.success ? "success" : "error",
    })),
  );
  let activeResultItem = $derived(
    flowResultItems.find((item) => item.key === activeResultKey) ||
      flowResultItems[0] ||
      null,
  );
  let activeFlowResult = $derived(activeResultItem?.row || null);
  let failedResultCount = $derived(
    flowResultPresentation.resultRows.filter((row) => !row.success).length,
  );
  let flowResultStatusMessage = $derived(
    commandFlowExecutionDisplay.statusMessage ||
      (flowResultPresentation.hasResult && !flowResultItems.length
        ? flowResultPresentation.resultSummaryMessage
        : ""),
  );
  let activeResultMetaFields = $derived(
    activeFlowResult
      ? [
          {
            label: t("fieldCommand"),
            value: activeFlowResult.commandText,
            mono: true,
          },
          {
            label: t("txBlockResultExitCode"),
            value: activeFlowResult.exitCodeText,
          },
        ]
      : [],
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

  $effect(() => {
    if (!flowResultItems.length) {
      activeResultKey = "";
      return;
    }
    if (!flowResultItems.some((item) => item.key === activeResultKey)) {
      activeResultKey = flowResultItems[0].key;
    }
  });
</script>

{#snippet flowExecutionResults()}
  {#if commandFlowExecutionDisplay.statusMessage || flowResultPresentation.hasResult}
    <div class="border-t-4 border-muted p-4 sm:p-5">
      <ExecutionResultsPanel
        icon={TerminalIcon}
        title={flowInputDisplay.resultsTitleText}
        description={flowInputDisplay.resultsDescriptionText}
        items={flowResultItems}
        activeKey={activeResultItem?.key || ""}
        navigationAriaLabel={flowInputDisplay.resultsTitleText}
        onSelect={(key) => (activeResultKey = key)}
        statusMessage={flowResultStatusMessage}
        statusTone={commandFlowExecutionDisplay.statusTone}
        totalCount={flowResultPresentation.hasResult
          ? flowResultPresentation.resultRows.length
          : null}
        succeededCount={flowResultPresentation.hasResult
          ? flowResultPresentation.resultRows.length - failedResultCount
          : null}
        failedCount={flowResultPresentation.hasResult
          ? failedResultCount
          : null}
        totalLabel={t("showResultCount")}
        succeededLabel={t("orchestrationStatusSuccess", "Success")}
        failedLabel={t("orchestrationStatusFailed", "Failed")}
      >
        {#if flowResultPresentation.exportAvailable}
          {#snippet actions()}
            <LoadingButton
              variant="outline"
              size="sm"
              loading={exportLoading}
              onclick={exportResultExcel}
            >
              <span>{flowResultPresentation.exportButtonLabel}</span>
            </LoadingButton>
          {/snippet}
        {/if}
        {#snippet detail()}
          {#if activeFlowResult}
            <ExecutionResultMeta fields={activeResultMetaFields} />
            {#if activeFlowResult.error}
              <StatusCard
                message={activeFlowResult.error}
                tone="error"
                variant="alert"
              />
            {/if}
            <OutputBlock
              title={activeFlowResult.commandText}
              tone={activeResultItem?.statusTone}
              errorLabel={t("orchestrationStatusFailed", "Failed")}
            >
              {activeFlowResult.outputText}
            </OutputBlock>
            {#if activeFlowResult.parsedOutputBlock}
              <ParsedOutputBlock
                parsedOutputBlock={activeFlowResult.parsedOutputBlock}
                onExportExcel={exportParsedOutputItemExcel}
              />
            {/if}
          {/if}
        {/snippet}
      </ExecutionResultsPanel>
    </div>
  {/if}
{/snippet}

<div
  data-command-flow-workbench
  class="grid min-w-0 gap-5 p-4 sm:p-5"
  hidden={!active}
>
  <CommandFlowTemplateSource
    surfaceVariant="section"
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

  <CommandFlowAuthoringViews
    activeTab={authoringDisplay.activeTab}
    ariaLabel={flowInputDisplay.workbenchTitleText}
    model={authoringDisplay.model}
    modeOptions={authoringDisplay.modeOptions}
    tomlLabel={flowInputDisplay.tomlFieldLabel}
    tomlHint={flowInputDisplay.tomlFieldHint}
    tomlText={authoringDisplay.tomlText}
    onSelectTab={changeFlowEditorTab}
    onModelChange={changeFlowModel}
    onTomlChange={changeFlowToml}
  />

  <CommandFlowRuntimeFields
    surfaceVariant="section"
    display={flowVarsDisplay}
    onFieldValueChange={changeFlowVarValue}
  />

  {#if active}
    <CommandFlowSurface
      variant="section"
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

  {#if active}
    <CommandFlowSurface
      variant="section"
      title={t("sessionRetrySectionTitle")}
      description={t("sessionRetrySectionHint")}
    >
      <SessionRetryFields
        idPrefix="flow-session-retry"
        value={flowRetryState}
        onChange={changeFlowRetry}
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
        disabled={!authoringDisplay.canRun ||
          authoringBusy ||
          !flowPanelDisplay.flowRetryValid}
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

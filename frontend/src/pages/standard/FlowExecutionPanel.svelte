<script>
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import OutputBlock from "../../components/fragments/OutputBlock.svelte";
  import ParsedOutputBlock from "../../components/fragments/ParsedOutputBlock.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import StringSelectField from "../../components/fragments/StringSelectField.svelte";
  import TextfsmControls from "../../components/fragments/TextfsmControls.svelte";
  import {
    createFlowExecutionPanelWorkspace,
    exportStandardParsedOutputItemExcel,
  } from "../../modules/standard.js";
  import FlowVarsInputPanel from "./FlowVarsInputPanel.svelte";

  let { active } = $props();
  const flowExecutionWorkspace = createFlowExecutionPanelWorkspace();
  const {
    changeFlowJsonOverrides,
    changeFlowTemplateName,
    changeFlowTextfsmEnabled,
    changeFlowTextfsmPlatform,
    changeFlowTextfsmStrictErrors,
    changeFlowTextfsmTemplate,
    changeFlowVarValue,
    executeFlowExecution,
    flowPanelDisplayStateStore,
    runActionHandlers,
    setPanelContext,
  } = flowExecutionWorkspace;
  let flowPanelDisplay = $derived($flowPanelDisplayStateStore);
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
  let exportResultExcel = $derived(runActionHandlers.export);

  $effect(() => {
    setPanelContext({ active, flowPanelDisplay });
  });
</script>

{#snippet flowExecutionResults()}
  <div class="grid gap-2">
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
        <div class="mb-2 flex justify-end">
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
        <div class="grid gap-2">
          {#each flowResultPresentation.resultRows as flowResultRow}
            <div class="rounded-xl border border-slate-200 bg-white px-3 py-2">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-sm font-semibold text-slate-800">
                  {flowResultRow.flowRowTitleText}
                </span>
                <span class={flowResultRow.flowBadgeClass}>
                  {flowResultRow.statusLabel}
                </span>
              </div>
              <div class="mt-2 text-xs text-slate-500">
                {flowResultRow.exitCodeMetaText}
              </div>
              <OutputBlock class="mt-2">{flowResultRow.outputText}</OutputBlock>
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
  </div>
{/snippet}

<div class="grid gap-3" hidden={!active}>
  <StringSelectField
    placeholderText={flowInputDisplay.templateField.placeholder}
    aria-label={flowInputDisplay.templateField.ariaLabelText}
    title={flowInputDisplay.templateField.placeholder}
    value={flowInputDisplay.templateField.value}
    optionValues={flowInputDisplay.templateOptionRows}
    onValueChange={changeFlowTemplateName}
  />

  <FlowVarsInputPanel
    onJsonOverridesChange={changeFlowJsonOverrides}
    onFlowVarValueChange={changeFlowVarValue}
    {flowVarsDisplay}
  />

  {#if active}
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
  {/if}

  <div class="grid gap-2 md:grid-cols-[1fr_auto]">
    <div class="text-xs text-slate-500">{flowInputDisplay.hintText}</div>
    <LoadingButton
      variant="default"
      size="sm"
      loading={flowRunButtonDisplay.executeLoading}
      onclick={executeFlowExecution}
    >
      <span>{flowInputDisplay.executeButtonLabel}</span>
    </LoadingButton>
  </div>
  {@render flowExecutionResults()}
</div>

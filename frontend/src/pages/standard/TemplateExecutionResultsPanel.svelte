<script>
  import * as Card from "$lib/components/ui/card";
  import DetailFieldCard from "../../components/fragments/DetailFieldCard.svelte";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import OutputBlock from "../../components/fragments/OutputBlock.svelte";
  import ParsedOutputBlock from "../../components/fragments/ParsedOutputBlock.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import SummaryMetricCard from "../../components/fragments/SummaryMetricCard.svelte";
  import {
    createTemplateExecutionResultsPanelWorkspace,
    exportStandardParsedOutputItemExcel,
  } from "../../modules/standard.js";

  let { templateExecutionDisplay } = $props();
  const templateExecutionResultsWorkspace =
    createTemplateExecutionResultsPanelWorkspace();
  const {
    executionRowsDisplayStateStore,
    exportLoadingStateStore,
    exportTemplateExecutionResults,
    panelDisplayStateStore,
    setResultsContext,
  } = templateExecutionResultsWorkspace;
  let panelDisplay = $derived($panelDisplayStateStore);
  let executionRowsDisplay = $derived($executionRowsDisplayStateStore);
  let exportLoadingState = $derived($exportLoadingStateStore);
  let exportLoading = $derived(exportLoadingState.exportLoading);

  function exportExecutionRows() {
    return exportTemplateExecutionResults(executionRowsDisplay);
  }

  $effect(() => {
    setResultsContext({ templateExecutionDisplay });
  });
</script>

{#snippet executionRowCard(executionRow)}
  <div class={executionRow.cardClass}>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class={executionRow.stepIndexClass}>
        {executionRow.stepNumberText}
      </div>
      <span class={executionRow.statusChipClass}>
        <span class={executionRow.statusTextClass}>
          {executionRow.statusShortText}
        </span>
      </span>
    </div>
    <DetailFieldCard
      class="mt-2"
      label={panelDisplay.commandLabel}
      detailValue={executionRow.commandText}
      mono
    />
    {#if executionRow.outputText}
      <OutputBlock class="mt-2">{executionRow.outputText}</OutputBlock>
    {/if}
    {#if executionRow.parsedOutputBlock}
      <ParsedOutputBlock
        parsedOutputBlock={executionRow.parsedOutputBlock}
        onExportExcel={exportStandardParsedOutputItemExcel}
      />
    {/if}
    {#if executionRow.error}
      <div
        class="mt-2 rounded-lg border border-rose-200 bg-rose-100 px-3 py-2 text-xs text-rose-700"
      >
        {executionRow.error}
      </div>
    {/if}
  </div>
{/snippet}

<Card.Root>
  <Card.Header>
    <Card.Title>{panelDisplay.visualTitle}</Card.Title>
  </Card.Header>
  <Card.Content>
    {#if panelDisplay.showStatusCard}
      <StatusCard
        message={panelDisplay.statusMessage}
        tone={panelDisplay.statusTone}
      />
    {/if}
    {#if panelDisplay.showResultSection}
      <div class="grid gap-3">
        <div class="grid gap-2 md:grid-cols-3">
          {#each panelDisplay.summaryCards as summaryCard}
            <SummaryMetricCard
              label={summaryCard.label}
              metricValue={summaryCard.summaryValue}
            />
          {/each}
        </div>
        <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
          <div class="text-sm font-semibold text-slate-900">
            {panelDisplay.renderedTitle}
          </div>
          <OutputBlock class="mt-2">
            {panelDisplay.renderedCommandsText}
          </OutputBlock>
        </section>
        <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="text-sm font-semibold text-slate-900">
              {panelDisplay.executedTitle}
            </div>
            {#if executionRowsDisplay.exportAvailable}
              <LoadingButton
                variant="outline"
                size="sm"
                loading={exportLoading}
                onclick={exportExecutionRows}
              >
                <span>{panelDisplay.exportButtonLabel}</span>
              </LoadingButton>
            {/if}
          </div>
          <div class="mt-2 grid gap-2">
            {#if executionRowsDisplay.hasExecutedRows}
              {#each panelDisplay.executedRows as executionRow}
                {@render executionRowCard(executionRow)}
              {/each}
            {:else}
              <div
                class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
              >
                {panelDisplay.noItemsText}
              </div>
            {/if}
          </div>
        </section>
      </div>
    {/if}
  </Card.Content>
</Card.Root>

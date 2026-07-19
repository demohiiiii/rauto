<script>
  import OutputBlock from "../../components/fragments/OutputBlock.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import SummaryMetricCard from "../../components/fragments/SummaryMetricCard.svelte";
  import { createOrchestrationExecutionPanelWorkspace } from "../../modules/orchestration/orchestrationResultState.js";
  import OrchestrationExecutionStagePanel from "./OrchestrationExecutionStagePanel.svelte";

  let { panelDisplay } = $props();
  const orchestrationExecutionPanelWorkspace =
    createOrchestrationExecutionPanelWorkspace();
  const {
    executionCallbacksStateStore,
    executionModeDisplayStateStore,
    resultDisplayStateStore,
    setExecutionPanelContext,
    statusDisplayStateStore,
  } = orchestrationExecutionPanelWorkspace;
  let resultDisplay = $derived($resultDisplayStateStore);
  let statusDisplay = $derived($statusDisplayStateStore);
  let executionModeDisplay = $derived($executionModeDisplayStateStore);
  let executionCallbacks = $derived($executionCallbacksStateStore);

  $effect(() => {
    setExecutionPanelContext({ panelDisplay });
  });
</script>

<div class="mt-2 grid gap-2">
  {#if executionModeDisplay.showText}
    <OutputBlock class="max-h-96" contentClass="whitespace-pre-wrap break-all"
      >{statusDisplay.text}</OutputBlock
    >
  {:else if executionModeDisplay.showStatus}
    <StatusCard message={statusDisplay.message} tone={statusDisplay.tone} />
  {:else if executionModeDisplay.showResult}
    {#if resultDisplay.hasResult}
      <div class="grid gap-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="text-sm font-semibold text-slate-900">
            {resultDisplay.resultTitle}
          </div>
          <div class="text-xs text-slate-500">
            {resultDisplay.stageCountSummaryText}
          </div>
        </div>
        <div class="grid gap-2 md:grid-cols-4">
          {#each resultDisplay.summaryCards as summaryCard}
            <SummaryMetricCard
              label={summaryCard.label}
              metricValue={summaryCard.summaryValue}
              size="lg"
            />
          {/each}
        </div>
        {#if resultDisplay.hasStageRows}
          {#each resultDisplay.stageRows as stageRow, stageIndex}
            <OrchestrationExecutionStagePanel
              {stageRow}
              stageCallbacks={executionCallbacks.stagePanelCallbacks(
                stageIndex,
              )}
            />
          {/each}
        {:else}
          <StatusCard message={resultDisplay.emptyMessage} />
        {/if}
      </div>
    {:else}
      <OutputBlock>{resultDisplay.requestFailedMessage}</OutputBlock>
    {/if}
  {/if}
</div>

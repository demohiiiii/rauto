<script>
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import OutputBlock from "../../components/fragments/OutputBlock.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import SummaryMetricCard from "../../components/fragments/SummaryMetricCard.svelte";
  import { createTxWorkflowRunPanelWorkspace } from "../../modules/transactionExecutionDisplays.js";
  import TxWorkflowBlockResultPanel from "./TxWorkflowBlockResultPanel.svelte";
  import TxWorkflowPreviewPanel from "./TxWorkflowPreviewPanel.svelte";

  let { panelDisplay, onPreview, onExecute } = $props();
  const txWorkflowRunPanelWorkspace = createTxWorkflowRunPanelWorkspace();
  const {
    executionModeDisplayStateStore,
    executionStatusDisplayStateStore,
    setPanelDisplay,
    workflowExecutionResultDisplayStateStore,
  } = txWorkflowRunPanelWorkspace;

  $effect(() => {
    setPanelDisplay(panelDisplay);
  });
</script>

<div class="grid grid-cols-2 gap-2">
  <LoadingButton
    variant="outline"
    size="sm"
    loading={panelDisplay.loadingDisplay.preview}
    onclick={onPreview}
  >
    <span>{panelDisplay.planButtonLabel}</span>
  </LoadingButton>
  <LoadingButton
    variant="default"
    size="sm"
    loading={panelDisplay.loadingDisplay.execute}
    onclick={onExecute}
  >
    <span>{panelDisplay.executeButtonLabel}</span>
  </LoadingButton>
</div>

<TxWorkflowPreviewPanel previewDisplay={panelDisplay.previewDisplay} />

{#if panelDisplay.planStatusModeDisplay.showStatus}
  <div class="mt-2 grid gap-2">
    <StatusCard
      message={panelDisplay.planStatusDisplay.message}
      tone={panelDisplay.planStatusDisplay.tone}
    />
  </div>
{/if}

<div class="mt-2 grid gap-2">
  {#if $executionModeDisplayStateStore.showText}
    <OutputBlock class="max-h-96" contentClass="whitespace-pre-wrap break-all"
      >{$executionStatusDisplayStateStore.text}</OutputBlock
    >
  {:else if $executionModeDisplayStateStore.showStatus}
    <StatusCard
      message={$executionStatusDisplayStateStore.message}
      tone={$executionStatusDisplayStateStore.tone}
    />
  {:else if $executionModeDisplayStateStore.showResult}
    {#if $workflowExecutionResultDisplayStateStore.hasResult}
      <div class="grid gap-3">
        <div class="grid gap-2 md:grid-cols-5">
          {#each $workflowExecutionResultDisplayStateStore.summaryCards as summaryCard}
            <SummaryMetricCard
              label={summaryCard.label}
              metricValue={summaryCard.summaryValue}
            />
          {/each}
        </div>
        {#if $workflowExecutionResultDisplayStateStore.hasRollbackErrors}
          <div
            class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
          >
            <div class="font-semibold">
              {$workflowExecutionResultDisplayStateStore.rollbackErrorsTitle}
            </div>
            <div class="mt-1 break-all">
              {$workflowExecutionResultDisplayStateStore.rollbackErrorsText}
            </div>
          </div>
        {/if}
        {#if $workflowExecutionResultDisplayStateStore.hasBlockRows}
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="grid gap-1">
              <div class="text-sm font-semibold text-slate-900">
                {$workflowExecutionResultDisplayStateStore.blockResultsTitle}
              </div>
              <div class="text-xs text-slate-500">
                {$workflowExecutionResultDisplayStateStore.blockCountLineText}
              </div>
            </div>
            <div
              class="inline-flex flex-wrap items-center gap-2 text-xs text-slate-500"
            >
              {#each $workflowExecutionResultDisplayStateStore.workflowSummaryChipRows as workflowSummaryChip}
                <span class={workflowSummaryChip.chipClass}>
                  {workflowSummaryChip.chipText}
                </span>
              {/each}
            </div>
          </div>
          {#each $workflowExecutionResultDisplayStateStore.blockRows as workflowBlockRow}
            <TxWorkflowBlockResultPanel {workflowBlockRow} />
          {/each}
        {:else}
          <StatusCard
            message={$workflowExecutionResultDisplayStateStore.noStepDetailsMessage}
          />
        {/if}
      </div>
    {:else}
      <OutputBlock
        >{$workflowExecutionResultDisplayStateStore.requestFailedMessage}</OutputBlock
      >
    {/if}
  {/if}
</div>

<script lang="ts">
  import * as Alert from "$lib/components/ui/alert";
  import OutputBlock from "$components/fragments/OutputBlock.svelte";
  import StatusCard from "$components/fragments/StatusCard.svelte";
  import SummaryMetricCard from "$components/fragments/SummaryMetricCard.svelte";
  import { currentLanguageState } from "$lib/i18n.js";
  import type { JsonValue } from "$lib/jsonValue.js";
  import { txWorkflowExecutionPresentation } from "../../transactionExecutionDisplays.js";
  import TxWorkflowBlockResultPanel from "./TxWorkflowBlockResultPanel.svelte";
  let { result }: { result: JsonValue } = $props();
  let display = $derived.by(() => {
    $currentLanguageState;
    return txWorkflowExecutionPresentation(result);
  });
</script>

<div class="grid min-w-0 gap-4">
  {#if display.hasResult}
    <div class="grid min-w-0 gap-4">
      <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {#each display.summaryCards as summaryCard}
          <SummaryMetricCard
            label={summaryCard.label}
            metricValue={summaryCard.summaryValue}
          />
        {/each}
      </div>
      {#if display.hasRollbackErrors}
        <Alert.Root variant="destructive">
          <Alert.Title>
            {display.rollbackErrorsTitle}
          </Alert.Title>
          <Alert.Description class="break-all">
            {display.rollbackErrorsText}
          </Alert.Description>
        </Alert.Root>
      {/if}
      {#if display.hasBlockRows}
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div class="grid gap-1">
            <div class="text-sm font-semibold text-foreground">
              {display.blockResultsTitle}
            </div>
            <div class="text-xs text-muted-foreground">
              {display.blockCountLineText}
            </div>
          </div>
          <div
            class="inline-flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
          >
            {#each display.workflowSummaryChipRows as workflowSummaryChip}
              <span class={workflowSummaryChip.chipClass}>
                {workflowSummaryChip.chipText}
              </span>
            {/each}
          </div>
        </div>
        <div class="grid min-w-0 gap-3">
          {#each display.blockRows as workflowBlockRow}
            <TxWorkflowBlockResultPanel {workflowBlockRow} />
          {/each}
        </div>
      {:else}
        <StatusCard message={display.noStepDetailsMessage} />
      {/if}
    </div>
  {:else}
    <OutputBlock>{display.requestFailedMessage}</OutputBlock>
  {/if}
</div>

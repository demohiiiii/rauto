<script>
  import PlayIcon from "@lucide/svelte/icons/play";
  import * as Alert from "$lib/components/ui/alert";
  import * as Card from "$lib/components/ui/card";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import OutputBlock from "../../components/fragments/OutputBlock.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import SummaryMetricCard from "../../components/fragments/SummaryMetricCard.svelte";
  import { t } from "../../lib/i18n.js";
  import { createTxWorkflowRunPanelWorkspace } from "../../modules/transactionExecutionDisplays.js";
  import TxWorkflowBlockResultPanel from "./TxWorkflowBlockResultPanel.svelte";

  let { panelDisplay, onExecute } = $props();
  const txWorkflowRunPanelWorkspace = createTxWorkflowRunPanelWorkspace();
  const {
    executionModeDisplayStateStore,
    executionStatusDisplayStateStore,
    setPanelDisplay,
    workflowExecutionResultDisplayStateStore,
  } = txWorkflowRunPanelWorkspace;
  let hasExecutionOutput = $derived(
    !!$executionModeDisplayStateStore.showText ||
      !!$executionModeDisplayStateStore.showStatus ||
      !!$executionModeDisplayStateStore.showResult,
  );

  $effect(() => {
    setPanelDisplay(panelDisplay);
  });
</script>

<Card.Root class="min-w-0 gap-0 overflow-hidden py-0">
  <Card.Header class="border-b bg-muted/15 p-4 sm:p-5">
    <Card.Title>{t("txWorkflowRunTitle")}</Card.Title>
    <Card.Description>{t("txWorkflowRunHint")}</Card.Description>
    <Card.Action>
      <LoadingButton
        variant="default"
        size="sm"
        loading={panelDisplay.loadingDisplay.execute}
        onclick={onExecute}
      >
        <PlayIcon data-icon="inline-start" />
        <span>{panelDisplay.executeButtonLabel}</span>
      </LoadingButton>
    </Card.Action>
  </Card.Header>

  {#if hasExecutionOutput}
    <Card.Content class="grid min-w-0 gap-4 p-4 sm:p-5">
      {#if $executionModeDisplayStateStore.showText}
        <OutputBlock
          class="max-h-96"
          contentClass="whitespace-pre-wrap break-all"
          >{$executionStatusDisplayStateStore.text}</OutputBlock
        >
      {:else if $executionModeDisplayStateStore.showStatus}
        <StatusCard
          message={$executionStatusDisplayStateStore.message}
          tone={$executionStatusDisplayStateStore.tone}
        />
      {:else if $executionModeDisplayStateStore.showResult}
        {#if $workflowExecutionResultDisplayStateStore.hasResult}
          <div class="grid min-w-0 gap-4">
            <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {#each $workflowExecutionResultDisplayStateStore.summaryCards as summaryCard}
                <SummaryMetricCard
                  label={summaryCard.label}
                  metricValue={summaryCard.summaryValue}
                />
              {/each}
            </div>
            {#if $workflowExecutionResultDisplayStateStore.hasRollbackErrors}
              <Alert.Root variant="destructive">
                <Alert.Title>
                  {$workflowExecutionResultDisplayStateStore.rollbackErrorsTitle}
                </Alert.Title>
                <Alert.Description class="break-all">
                  {$workflowExecutionResultDisplayStateStore.rollbackErrorsText}
                </Alert.Description>
              </Alert.Root>
            {/if}
            {#if $workflowExecutionResultDisplayStateStore.hasBlockRows}
              <div class="flex flex-wrap items-end justify-between gap-3">
                <div class="grid gap-1">
                  <div class="text-sm font-semibold text-foreground">
                    {$workflowExecutionResultDisplayStateStore.blockResultsTitle}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    {$workflowExecutionResultDisplayStateStore.blockCountLineText}
                  </div>
                </div>
                <div
                  class="inline-flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
                >
                  {#each $workflowExecutionResultDisplayStateStore.workflowSummaryChipRows as workflowSummaryChip}
                    <span class={workflowSummaryChip.chipClass}>
                      {workflowSummaryChip.chipText}
                    </span>
                  {/each}
                </div>
              </div>
              <div class="grid min-w-0 gap-3">
                {#each $workflowExecutionResultDisplayStateStore.blockRows as workflowBlockRow}
                  <TxWorkflowBlockResultPanel {workflowBlockRow} />
                {/each}
              </div>
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
    </Card.Content>
  {/if}
</Card.Root>

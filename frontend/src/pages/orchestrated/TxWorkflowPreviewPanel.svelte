<script>
  import * as Card from "$lib/components/ui/card";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import SummaryMetricCard from "../../components/fragments/SummaryMetricCard.svelte";
  import TxBlockPreviewPanel from "./TxBlockPreviewPanel.svelte";

  let { previewDisplay } = $props();
  let previewModeDisplay = $derived(previewDisplay.previewModeDisplay);
  let previewPresentation = $derived(previewDisplay.previewPresentation);
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>{previewPresentation.titleText}</Card.Title>
  </Card.Header>
  <Card.Content class="grid gap-2">
    {#if previewModeDisplay.showText}
      {previewDisplay.text}
    {:else if previewModeDisplay.showStatus}
      <StatusCard message={previewDisplay.message} tone={previewDisplay.tone} />
    {:else}
      {#if !previewPresentation.hasWorkflow}
        <StatusCard message={previewPresentation.emptyMessage} />
      {:else}
        <div class="grid gap-3">
          <div class="grid gap-2 md:grid-cols-3">
            {#each previewPresentation.summaryCards as summaryCard}
              <SummaryMetricCard
                label={summaryCard.label}
                metricValue={summaryCard.summaryValue}
              />
            {/each}
          </div>
          {#if previewPresentation.hasBlocks}
            {#each previewPresentation.blockRows as workflowBlockRow}
              <section
                class="rounded-xl border border-slate-200 bg-white px-3 py-3"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="text-sm font-semibold text-slate-900">
                    {workflowBlockRow.title}
                  </div>
                  <div class="inline-flex flex-wrap items-center gap-1">
                    {#each workflowBlockRow.chipRows as chipRow}
                      <span class={chipRow.chipClass}>
                        {chipRow.chipText}
                      </span>
                    {/each}
                  </div>
                </div>
                {#if workflowBlockRow.isTemplate}
                  <div
                    class="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
                  >
                    {workflowBlockRow.templateHintText}
                  </div>
                {:else}
                  <div class="mt-2 grid gap-2">
                    <TxBlockPreviewPanel
                      previewPresentation={workflowBlockRow.previewPresentation}
                      showSummary={false}
                      showResult={false}
                    />
                  </div>
                {/if}
              </section>
            {/each}
          {:else}
            <StatusCard message={previewPresentation.emptyMessage} />
          {/if}
        </div>
      {/if}
    {/if}
  </Card.Content>
</Card.Root>

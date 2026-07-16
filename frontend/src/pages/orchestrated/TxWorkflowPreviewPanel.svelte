<script>
  import * as Card from "$lib/components/ui/card";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import SummaryMetricCard from "../../components/fragments/SummaryMetricCard.svelte";
  import TxBlockPreviewPanel from "./TxBlockPreviewPanel.svelte";

  let {
    framed = true,
    previewDisplay = null,
    previewPresentation = null,
  } = $props();
  let previewModeDisplay = $derived(
    previewDisplay?.previewModeDisplay || {
      showStatus: false,
      showText: false,
    },
  );
  let presentation = $derived(
    previewPresentation || previewDisplay?.previewPresentation || {},
  );
</script>

{#snippet previewContent()}
  {#if previewModeDisplay.showText}
    <div class="whitespace-pre-wrap break-all text-sm text-foreground">
      {previewDisplay?.text || ""}
    </div>
  {:else if previewModeDisplay.showStatus}
    <StatusCard
      message={previewDisplay?.message || ""}
      tone={previewDisplay?.tone || "info"}
    />
  {:else if !presentation.hasWorkflow}
    <StatusCard message={presentation.emptyMessage || ""} />
  {:else}
    <div class="grid min-w-0 gap-4">
      <div class="grid gap-2 md:grid-cols-3">
        {#each presentation.summaryCards || [] as summaryCard}
          <SummaryMetricCard
            label={summaryCard.label}
            metricValue={summaryCard.summaryValue}
          />
        {/each}
      </div>
      {#if presentation.hasBlocks}
        <div class="grid min-w-0 gap-3">
          {#each presentation.blockRows as workflowBlockRow}
            <section class="rounded-xl border border-border bg-card px-3 py-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="text-sm font-semibold text-foreground">
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
                  class="mt-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
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
        </div>
      {:else}
        <StatusCard message={presentation.emptyMessage || ""} />
      {/if}
    </div>
  {/if}
{/snippet}

{#if framed}
  <Card.Root class="min-w-0">
    <Card.Header>
      <Card.Title>{presentation.titleText || ""}</Card.Title>
    </Card.Header>
    <Card.Content class="grid min-w-0 gap-2">
      {@render previewContent()}
    </Card.Content>
  </Card.Root>
{:else}
  <div class="grid min-w-0 gap-2">
    {@render previewContent()}
  </div>
{/if}

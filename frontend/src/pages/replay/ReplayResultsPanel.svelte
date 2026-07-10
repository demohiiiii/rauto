<script>
  import DetailFieldCard from "../../components/fragments/DetailFieldCard.svelte";
  import EventEntriesTable from "../../components/fragments/EventEntriesTable.svelte";
  import OutputBlock from "../../components/fragments/OutputBlock.svelte";
  import SummaryMetricCard from "../../components/fragments/SummaryMetricCard.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";

  let { onOpenEntryIndex, resultsDisplay } = $props();
</script>

<div class="grid gap-2">
  <div class="grid gap-3" hidden={!resultsDisplay.showListMode}>
    {#if resultsDisplay.statusText}
      <StatusCard message={resultsDisplay.statusText} />
    {:else if !resultsDisplay.hasReplayResult}
      <StatusCard message={resultsDisplay.emptyResultText} />
    {:else}
      {#if resultsDisplay.hasReplayContext}
        <section class="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div class="mb-1 text-xs font-semibold text-slate-500">
            {resultsDisplay.contextTitle}
          </div>
          <div class="grid gap-2 md:grid-cols-3">
            {#each resultsDisplay.replayContextRows as replayContextRow (replayContextRow.key)}
              <DetailFieldCard
                label={replayContextRow.labelText}
                detailValue={replayContextRow.detailValue}
                mono
              />
            {/each}
          </div>
        </section>
      {/if}
      {#if resultsDisplay.hasReplayEntries}
        <div class="grid gap-2 md:grid-cols-4">
          {#each resultsDisplay.replayStatCards as replayStatCard}
            <SummaryMetricCard
              label={replayStatCard.label}
              metricValue={replayStatCard.statValue}
              size="lg"
            />
          {/each}
        </div>
        <EventEntriesTable
          entryRows={resultsDisplay.replayEntryRows}
          {onOpenEntryIndex}
          tableHeaderCells={resultsDisplay.replayTableHeaderCells}
        />
      {/if}
      {#if resultsDisplay.hasReplayOutput}
        <div
          class="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
        >
          <div class="mb-2 text-xs font-semibold text-slate-500">
            {resultsDisplay.outputTitle}
          </div>
          <div class="inline-flex items-center gap-2 text-xs">
            <span class={resultsDisplay.outputStatusClass}>
              {resultsDisplay.outputStatusLabel}
            </span>
            <span class="font-mono text-slate-600">
              {resultsDisplay.outputPromptText}
            </span>
          </div>
          <pre
            class="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-md bg-slate-900 p-2 text-xs text-slate-100">{resultsDisplay.outputContent}</pre>
        </div>
      {/if}
      {#if !resultsDisplay.hasReplayEntries && !resultsDisplay.hasReplayOutput}
        <StatusCard message={resultsDisplay.emptyReplayText} />
      {/if}
    {/if}
  </div>

  <OutputBlock hidden={!resultsDisplay.showRawMode}>
    {resultsDisplay.rawResultText}
  </OutputBlock>
</div>

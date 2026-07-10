<script>
  import OrchestrationPreviewJobCard from "./OrchestrationPreviewJobCard.svelte";
  import OrchestrationPreviewTargetChips from "./OrchestrationPreviewTargetChips.svelte";

  let { previewStageRow } = $props();
</script>

<section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="text-sm font-semibold text-slate-900">
      {previewStageRow.label}
    </div>
    <div class="inline-flex flex-wrap items-center gap-1">
      {#each previewStageRow.summaryChipRows as summaryChipRow}
        <span class={summaryChipRow.chipClass}>
          {summaryChipRow.chipText}
        </span>
      {/each}
    </div>
  </div>
  <div class="mt-2 flex flex-wrap gap-2">
    <OrchestrationPreviewTargetChips
      chipRows={previewStageRow.targetChipRows}
      hasValues={previewStageRow.hasTargetLabels}
      emptyText={previewStageRow.noTargetText}
    />
  </div>
  <div class="mt-2 grid gap-2">
    {#if previewStageRow.hasJobs}
      {#each previewStageRow.jobs as previewJob}
        <OrchestrationPreviewJobCard
          {previewJob}
          noTargetText={previewStageRow.noTargetText}
        />
      {/each}
    {:else}
      <div class="text-xs text-slate-500">
        {previewStageRow.noJobsText}
      </div>
    {/if}
  </div>
</section>

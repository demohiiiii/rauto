<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import DetailFieldCard from "../../components/fragments/DetailFieldCard.svelte";

  let { stageCallbacks, stageRow } = $props();
</script>

{#snippet executionJobPanel(stageJobRow, stageJobIndex)}
  <div
    class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="font-semibold text-slate-900">
        {stageJobRow.title}
      </div>
      <div class="inline-flex flex-wrap items-center gap-2">
        <span class={stageJobRow.statusBadgeClass}>
          {stageJobRow.statusLabel}
        </span>
        {#each stageJobRow.targetSummaryChips as targetSummaryChip}
          <span class={targetSummaryChip.chipClass}>
            {targetSummaryChip.labelText}={targetSummaryChip.valueText}
          </span>
        {/each}
      </div>
    </div>
    <div class="mt-2 grid gap-1 md:grid-cols-3">
      {#each stageJobRow.actionFields as actionField}
        <DetailFieldCard
          detailValue={actionField.detailValue}
          label={actionField.label}
          mono={actionField.mono}
          variant="inline"
        />
      {/each}
    </div>
    <div class="mt-2 grid gap-2">
      {#if stageJobRow.hasTargetRows}
        {#each stageJobRow.targetRows as targetRow, targetIndex}
          <div
            class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="font-semibold text-slate-900">
                {targetRow.label}
              </div>
              <div class="inline-flex items-center gap-2">
                <span class={targetRow.statusBadgeClass}>
                  {targetRow.statusLabel}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onclick={stageCallbacks.openTargetDetailHandler(
                    stageJobIndex,
                    targetIndex,
                  )}
                >
                  {targetRow.detailButtonLabel}
                </Button>
              </div>
            </div>
            <div class="mt-2 grid gap-1 md:grid-cols-3">
              {#each targetRow.metaFields as targetMetaField}
                <DetailFieldCard
                  detailValue={targetMetaField.detailValue}
                  label={targetMetaField.labelText}
                  mono={targetMetaField.mono}
                  variant="inline"
                />
              {/each}
            </div>
            {#if targetRow.errorText}
              <div class="mt-1 text-rose-700">{targetRow.errorText}</div>
            {/if}
          </div>
        {/each}
      {:else}
        <div class="text-xs text-slate-500">{stageJobRow.noTargetText}</div>
      {/if}
    </div>
  </div>
{/snippet}

<section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="text-sm font-semibold text-slate-900">
      {stageRow.title}
    </div>
    <div class="inline-flex flex-wrap items-center gap-2">
      <span class={stageRow.statusBadgeClass}>{stageRow.statusLabel}</span>
      <div class="inline-flex flex-wrap items-center gap-1">
        {#each stageRow.stageSummaryChips as stageSummaryChip}
          <span class={stageSummaryChip.chipClass}>
            {stageSummaryChip.labelText}={stageSummaryChip.valueText}
          </span>
        {/each}
      </div>
      <Button
        variant="outline"
        size="sm"
        type="button"
        onclick={stageCallbacks.openStageDetail}
      >
        {stageRow.detailButtonLabel}
      </Button>
    </div>
  </div>
  <div class="mt-2 grid gap-2">
    {#if stageRow.hasJobs}
      {#each stageRow.jobs as stageJobRow, stageJobIndex}
        {@render executionJobPanel(stageJobRow, stageJobIndex)}
      {/each}
    {:else}
      <div class="text-xs text-slate-500">{stageRow.noJobsText}</div>
    {/if}
  </div>
</section>

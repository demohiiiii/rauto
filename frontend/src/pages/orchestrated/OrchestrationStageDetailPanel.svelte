<script>
  import DetailFieldCard from "../../components/fragments/DetailFieldCard.svelte";
  import { createOrchestrationStageDetailPanelWorkspace } from "../../modules/orchestrationWorkspace.js";
  import OrchestrationJsonSection from "./OrchestrationJsonSection.svelte";

  let {
    orchestrationBasicSectionTitle,
    orchestrationRawSectionTitle,
    hasStageJobRows,
    stageBasicFieldRows,
    stageJsonValue,
    stageJobRows,
  } = $props();

  const orchestrationStageDetailPanelWorkspace =
    createOrchestrationStageDetailPanelWorkspace();
  const { jobsPanelDisplayStateStore } = orchestrationStageDetailPanelWorkspace;
  let jobsPanelDisplay = $derived($jobsPanelDisplayStateStore);
</script>

{#snippet stageJobs()}
  <section class="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <div class="mb-2 text-xs font-semibold text-slate-600">
      {jobsPanelDisplay.sectionTitle}
    </div>
    <div class="grid gap-2">
      {#if hasStageJobRows}
        {#each stageJobRows as stageJobRow}
          <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="text-sm font-semibold text-slate-900">
                {stageJobRow.title}
              </div>
              <div class="inline-flex items-center gap-2">
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
                {#each stageJobRow.targetRows as targetRow}
                  <div
                    class="rounded-md border border-slate-200 bg-white px-2 py-1.5"
                  >
                    <div
                      class="flex flex-wrap items-center justify-between gap-1"
                    >
                      <div class="text-xs font-semibold text-slate-900">
                        {targetRow.label}
                      </div>
                      <span class={targetRow.statusBadgeClass}>
                        {targetRow.statusLabel}
                      </span>
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
                  </div>
                {/each}
              {:else}
                <div
                  class="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-500"
                >
                  -
                </div>
              {/if}
            </div>
          </div>
        {/each}
      {:else}
        <div
          class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
        >
          -
        </div>
      {/if}
    </div>
  </section>
{/snippet}

<div class="grid gap-3">
  <section class="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <div class="mb-2 text-xs font-semibold text-slate-600">
      {orchestrationBasicSectionTitle}
    </div>
    <div class="grid gap-2 md:grid-cols-2">
      {#each stageBasicFieldRows as stageBasicFieldRow}
        <DetailFieldCard
          badgeClass={stageBasicFieldRow.badgeClass}
          label={stageBasicFieldRow.labelText}
          mono={stageBasicFieldRow.mono}
          detailValue={stageBasicFieldRow.detailValue}
        />
      {/each}
    </div>
  </section>
  {@render stageJobs()}
  <OrchestrationJsonSection
    jsonValue={stageJsonValue}
    title={orchestrationRawSectionTitle}
  />
</div>

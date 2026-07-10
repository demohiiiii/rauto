<script>
  import DetailFieldCard from "../../components/fragments/DetailFieldCard.svelte";
  import OutputBlock from "../../components/fragments/OutputBlock.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import SummaryMetricCard from "../../components/fragments/SummaryMetricCard.svelte";

  let { taskDetail } = $props();
</script>

{#snippet taskBadge(taskBadgeLabel, taskBadgeClass)}
  <span class={taskBadgeClass}>
    {taskBadgeLabel}
  </span>
{/snippet}

{#snippet taskJsonOutputSection(sectionTitle, jsonPreviewText)}
  <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
    <div class="text-sm font-semibold text-slate-900">
      {sectionTitle}
    </div>
    <OutputBlock class="mt-2">{jsonPreviewText}</OutputBlock>
  </section>
{/snippet}

{#snippet taskArtifactsSection()}
  <section class="grid gap-2">
    <div class="text-sm font-semibold text-slate-900">
      {taskDetail.artifactsTitle}
    </div>
    {#if taskDetail.hasArtifactGroups}
      {#each taskDetail.artifactGroups as artifactGroup}
        <section
          class="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
        >
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div class="text-sm font-semibold text-slate-900">
              {artifactGroup.label}
            </div>
            <div class="flex flex-wrap items-center gap-2">
              {#each artifactGroup.badgeRows as artifactGroupBadgeRow}
                {@render taskBadge(
                  artifactGroupBadgeRow.label,
                  artifactGroupBadgeRow.badgeClass,
                )}
              {/each}
            </div>
          </div>
          <div class="grid gap-2">
            {#each artifactGroup.artifactRows as taskArtifact, taskArtifactIndex}
              <details
                class="rounded-xl border border-slate-200 bg-white"
                open={taskArtifactIndex === 0}
              >
                <summary class="cursor-pointer list-none px-3 py-3">
                  <div
                    class="flex flex-wrap items-center justify-between gap-2"
                  >
                    <div class="grid gap-1">
                      <div class="text-sm font-semibold text-slate-900">
                        {taskArtifact.title}
                      </div>
                      <div class="text-xs text-slate-500">
                        {taskArtifact.summaryText}
                      </div>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                      {#each taskArtifact.badgeRows as artifactBadgeRow}
                        {@render taskBadge(
                          artifactBadgeRow.label,
                          artifactBadgeRow.badgeClass,
                        )}
                      {/each}
                    </div>
                  </div>
                </summary>
                <div class="border-t border-slate-200 px-3 py-3">
                  <OutputBlock>{taskArtifact.contentText}</OutputBlock>
                </div>
              </details>
            {/each}
          </div>
        </section>
      {/each}
    {:else}
      <StatusCard message={taskDetail.artifactsEmptyMessage} />
    {/if}
  </section>
{/snippet}

<section class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
  <div class="flex flex-wrap items-center gap-2">
    {#each taskDetail.badgeRows as taskBadgeRow}
      {@render taskBadge(taskBadgeRow.label, taskBadgeRow.badgeClass)}
    {/each}
  </div>
  <div class="mt-2 break-all font-mono text-xs text-slate-500">
    {taskDetail.taskId}
  </div>
  <div class="mt-2 text-sm font-semibold text-slate-900">
    {taskDetail.summaryText}
  </div>
  <div class="mt-3 grid gap-1 text-xs text-slate-600">
    {#each taskDetail.detailLines as detailLineRow}
      <DetailFieldCard
        label={detailLineRow.label}
        detailValue={detailLineRow.detailValue}
        variant="inline"
      />
    {/each}
  </div>
</section>

<section class="grid gap-2 md:grid-cols-2">
  {#each taskDetail.summaryCards as summaryCardRow}
    <SummaryMetricCard
      label={summaryCardRow.label}
      metricValue={summaryCardRow.summaryValue}
    />
  {/each}
</section>

<section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
  <div class="text-sm font-semibold text-slate-900">
    {taskDetail.resultSummaryTitle}
  </div>
  <OutputBlock class="mt-2">{taskDetail.summaryPreview}</OutputBlock>
  <div class="mt-3 text-sm font-semibold text-slate-900">
    {taskDetail.summaryDetailsTitle}
  </div>
  <OutputBlock class="mt-2">{taskDetail.summaryDetailsPreview}</OutputBlock>
</section>

{@render taskArtifactsSection()}

{@render taskJsonOutputSection(taskDetail.errorTitle, taskDetail.errorPreview)}

{@render taskJsonOutputSection(
  taskDetail.resultTitle,
  taskDetail.resultPreview,
)}

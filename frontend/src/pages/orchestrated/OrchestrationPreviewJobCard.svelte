<script>
  import DetailFieldCard from "../../components/fragments/DetailFieldCard.svelte";
  import OrchestrationPreviewTargetChips from "./OrchestrationPreviewTargetChips.svelte";

  let { previewJob, noTargetText } = $props();
</script>

<section class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="text-xs font-semibold text-slate-900">
      {previewJob.titleText}
    </div>
    <div class="inline-flex flex-wrap items-center gap-1">
      {#each previewJob.chipRows as previewJobChipRow}
        <span class={previewJobChipRow.chipClass}>
          {previewJobChipRow.chipText}
        </span>
      {/each}
    </div>
  </div>
  <div
    class="mt-2 grid gap-1 rounded-lg border border-slate-200 bg-white p-2 md:grid-cols-3"
  >
    {#each previewJob.actionFields as actionField}
      <DetailFieldCard
        detailValue={actionField.detailValue}
        label={actionField.label}
        mono={actionField.mono}
        variant="inline"
      />
    {/each}
  </div>
  <div class="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2">
    <div
      class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
    >
      {previewJob.commandPreview.titleText}
    </div>
    <div class="grid gap-1">
      {#if previewJob.commandPreview.hasLines}
        {#each previewJob.commandPreview.lines as commandPreviewLine}
          <div
            class="break-all rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 font-mono text-xs text-cyan-900"
          >
            {commandPreviewLine}
          </div>
        {/each}
      {:else}
        <div class="text-xs text-slate-500">
          {previewJob.commandPreview.emptyMessage}
        </div>
      {/if}
    </div>
    {#if previewJob.commandPreview.showOverflow}
      <div class="text-[11px] text-slate-500">
        {previewJob.commandPreview.overflowText}
      </div>
    {/if}
  </div>
  {#if previewJob.hasTargetGroups}
    <div class="mt-2 text-xs text-slate-500">
      {previewJob.targetGroupsLineText}
    </div>
  {/if}
  {#if previewJob.hasTargetTags}
    <div class="mt-1 text-xs text-slate-500">
      {previewJob.targetTagsLineText}
    </div>
  {/if}
  <div class="mt-2 flex flex-wrap gap-2">
    <OrchestrationPreviewTargetChips
      chipRows={previewJob.targetChipRows}
      hasValues={previewJob.hasTargetLabels}
      emptyText={noTargetText}
    />
  </div>
</section>

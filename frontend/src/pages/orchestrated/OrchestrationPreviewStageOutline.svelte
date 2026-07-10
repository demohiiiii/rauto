<script>
  let { titleText, jobChipRow, stageRows = [] } = $props();
</script>

<section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="text-sm font-semibold text-slate-900">{titleText}</div>
    <span class={jobChipRow.chipClass}>{jobChipRow.chipText}</span>
  </div>
  <div class="mt-2 grid gap-2 md:grid-cols-2">
    {#each stageRows as previewStageRow}
      <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <div class="text-xs font-semibold text-slate-900">
          {previewStageRow.label}
        </div>
        <div class="mt-2 inline-flex flex-wrap gap-1">
          {#each previewStageRow.outlineChipRows as outlineChipRow}
            <span class={outlineChipRow.chipClass}>
              {outlineChipRow.chipText}
            </span>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</section>

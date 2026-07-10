<script>
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import SummaryMetricCard from "../../components/fragments/SummaryMetricCard.svelte";
  import { normalizeTxBlockPreviewPresentation } from "../../modules/transactionExecutionDisplays.js";
  import TxBlockResultPanel from "./TxBlockResultPanel.svelte";

  let { previewPresentation, showResult, showSummary } = $props();
  let safePreviewPresentation = $derived(
    normalizeTxBlockPreviewPresentation(previewPresentation),
  );
  let resultPanel = $derived(safePreviewPresentation.resultPanel);
</script>

<div class="grid gap-3">
  {#if showSummary}
    <div class="grid gap-2 md:grid-cols-3">
      {#each safePreviewPresentation.previewSummaryCards as previewSummaryCard}
        <SummaryMetricCard
          label={previewSummaryCard.label}
          metricValue={previewSummaryCard.summaryValue}
        />
      {/each}
    </div>
  {/if}
  {#if safePreviewPresentation.hasWholeResourceRollback}
    <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <div class="grid gap-2 md:grid-cols-3">
        {#each safePreviewPresentation.rollbackSummaryCards as rollbackSummaryCard}
          <SummaryMetricCard
            label={rollbackSummaryCard.label}
            metricValue={rollbackSummaryCard.summaryValue}
          />
        {/each}
      </div>
    </div>
  {/if}
  <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
    <div class="text-sm font-semibold text-slate-900">
      {safePreviewPresentation.stepsTitle}
    </div>
    <div class="mt-2 grid gap-2">
      {#if safePreviewPresentation.hasSteps}
        {#each safePreviewPresentation.stepRows as previewStepRow}
          <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="text-xs font-semibold text-slate-600">
                {previewStepRow.stepLabelText}
              </div>
              <div class="inline-flex flex-wrap items-center gap-1">
                {#each previewStepRow.stepChipRows as previewStepChipRow}
                  <span class={previewStepChipRow.chipClass}>
                    {previewStepChipRow.chipText}
                  </span>
                {/each}
              </div>
            </div>
            <div class="mt-2 grid gap-2 md:grid-cols-2">
              <div
                class="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2"
              >
                <div class="text-[11px] font-semibold text-cyan-700">
                  {previewStepRow.commandLabelText}
                </div>
                <div class="mt-1 break-all font-mono text-xs text-slate-900">
                  {previewStepRow.command}
                </div>
              </div>
              <div class={previewStepRow.rollbackCardClass}>
                <div class={previewStepRow.rollbackTitleClass}>
                  {previewStepRow.rollbackTitleText}
                </div>
                <div class={previewStepRow.rollbackCommandClass}>
                  {previewStepRow.rollbackCommand}
                </div>
              </div>
            </div>
          </div>
        {/each}
      {:else}
        <StatusCard message={safePreviewPresentation.emptyMessage} />
      {/if}
    </div>
  </section>
  {#if showResult}
    <TxBlockResultPanel {resultPanel} />
  {/if}
</div>

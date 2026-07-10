<script>
  import OutputBlock from "../../components/fragments/OutputBlock.svelte";
  import SummaryMetricCard from "../../components/fragments/SummaryMetricCard.svelte";
  import TxOperationStepCard from "./TxOperationStepCard.svelte";
  import TxStepResultDetail from "./TxStepResultDetail.svelte";

  let { resultPanel } = $props();
</script>

{#if resultPanel.hasTxResult}
  <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
    <div class="text-sm font-semibold text-slate-900">
      {resultPanel.resultTitle}
    </div>
    <div class="mt-2 grid gap-2 md:grid-cols-3">
      {#each resultPanel.summaryCards as summaryCard}
        <SummaryMetricCard
          label={summaryCard.label}
          metricValue={summaryCard.summaryValue}
        />
      {/each}
    </div>
    {#if resultPanel.hasRollbackErrors}
      <div
        class="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
      >
        <div class="font-semibold">
          {resultPanel.rollbackErrorsTitle}
        </div>
        <div class="mt-1 break-all">{resultPanel.rollbackErrorsText}</div>
      </div>
    {/if}
    {#if resultPanel.hasStepResultRows}
      <div class="mt-3 grid gap-3">
        {#each resultPanel.stepResultRows as stepResultRow}
          <TxStepResultDetail {stepResultRow} />
        {/each}
      </div>
    {:else}
      <div
        class="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
      >
        {resultPanel.noStepDetailsMessage}
      </div>
      {#if resultPanel.showFailureOutput}
        <div
          class="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2"
        >
          <div class="text-[11px] font-semibold text-rose-700">
            {resultPanel.outputTitle}
          </div>
          <OutputBlock class="mt-1">{resultPanel.failureOutput}</OutputBlock>
        </div>
      {/if}
    {/if}
    {#if resultPanel.hasBlockRollbackStepRows}
      <div
        class="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3"
      >
        <div class="mb-2 text-sm font-semibold text-amber-700">
          {resultPanel.blockRollbackOutputsTitle}
        </div>
        {#if resultPanel.hasBlockRollbackOperationSummary}
          <div
            class="mb-2 rounded-lg border border-amber-200 bg-white px-3 py-2"
          >
            <div class="text-[11px] font-semibold text-slate-500">
              {resultPanel.commandLabelText}
            </div>
            <div class="mt-1 break-all font-mono text-xs text-slate-900">
              {resultPanel.blockRollbackOperationSummaryText}
            </div>
          </div>
        {/if}
        <div class="grid gap-2">
          <div class="text-xs font-semibold text-slate-600">
            {resultPanel.rollbackOutputsTitle}
          </div>
          {#each resultPanel.blockRollbackStepRows as rollbackStepRow}
            <TxOperationStepCard operationStepRow={rollbackStepRow} />
          {/each}
        </div>
      </div>
    {/if}
  </section>
{/if}

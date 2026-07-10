<script>
  import DetailFieldCard from "../../components/fragments/DetailFieldCard.svelte";
  import TxOperationStepCard from "./TxOperationStepCard.svelte";

  let { stepResultRow } = $props();
</script>

{#snippet operationStepOutputs(title, operationRows, hasOperationRows)}
  {#if hasOperationRows}
    <div class="grid gap-2">
      <div class="text-xs font-semibold text-slate-600">{title}</div>
      {#each operationRows as operationStepRow}
        <TxOperationStepCard {operationStepRow} />
      {/each}
    </div>
  {:else}
    <div
      class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
    >
      {stepResultRow.noOperationOutputsMessage}
    </div>
  {/if}
{/snippet}

<section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="text-sm font-semibold text-slate-900">
      {stepResultRow.titleText}
    </div>
    <div class="inline-flex flex-wrap items-center gap-1">
      {#each stepResultRow.stateChipRows as stateChipRow}
        <span class={stateChipRow.chipClass}>{stateChipRow.chipText}</span>
      {/each}
    </div>
  </div>
  <div class="mt-2 grid gap-2 md:grid-cols-2">
    {#each stepResultRow.reasonRows as reasonRow}
      <DetailFieldCard
        label={reasonRow.titleText}
        detailValue={reasonRow.reasonText}
        variant={reasonRow.variant}
      />
    {/each}
  </div>
  <div class="mt-3 grid gap-3">
    {@render operationStepOutputs(
      stepResultRow.forwardOutputsTitle,
      stepResultRow.forwardOperationRows,
      stepResultRow.hasForwardOperationRows,
    )}
    {@render operationStepOutputs(
      stepResultRow.rollbackOutputsTitle,
      stepResultRow.rollbackOperationRows,
      stepResultRow.hasRollbackOperationRows,
    )}
  </div>
</section>

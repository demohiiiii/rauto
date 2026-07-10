<script>
  import DetailFieldCard from "../../components/fragments/DetailFieldCard.svelte";
  import OutputBlock from "../../components/fragments/OutputBlock.svelte";
  import ParsedOutputBlock from "../../components/fragments/ParsedOutputBlock.svelte";
  import { exportParsedOutputItemExcel as exportTransactionParsedOutputItemExcel } from "../../modules/results.js";

  let { operationStepRow } = $props();
</script>

<div class={operationStepRow.cardClass}>
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class={operationStepRow.titleClass}>
      {operationStepRow.titleText}
    </div>
    <div class="inline-flex flex-wrap items-center gap-1">
      {#each operationStepRow.chipRows as operationStepChipRow}
        <span class={operationStepRow.chipClass}>
          {operationStepChipRow.chipText}
        </span>
      {/each}
    </div>
  </div>
  <DetailFieldCard
    class="mt-2"
    label={operationStepRow.commandLabelText}
    detailValue={operationStepRow.operationSummaryText}
    mono
  />
  <div class="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
    <div class="text-[11px] font-semibold text-slate-500">
      {operationStepRow.outputLabelText}
    </div>
    <OutputBlock class="mt-1">{operationStepRow.outputText}</OutputBlock>
  </div>
  <ParsedOutputBlock
    parsedOutputBlock={operationStepRow.parsedOutputBlock}
    onExportExcel={exportTransactionParsedOutputItemExcel}
  />
  {#if operationStepRow.showPrompt}
    <DetailFieldCard
      class="mt-2"
      label={operationStepRow.promptLabelText}
      detailValue={operationStepRow.promptText}
      mono
    />
  {/if}
</div>

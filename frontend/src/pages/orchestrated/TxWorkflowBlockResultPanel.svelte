<script>
  import { createTxWorkflowBlockResultPanelWorkspace } from "../../modules/transactionExecutionDisplays.js";
  import OutputBlock from "../../components/fragments/OutputBlock.svelte";
  import TxOperationStepCard from "./TxOperationStepCard.svelte";
  import TxStepResultDetail from "./TxStepResultDetail.svelte";

  let { workflowBlockRow } = $props();
  const txWorkflowBlockResultPanelWorkspace =
    createTxWorkflowBlockResultPanelWorkspace();
  const { panelDisplayStateStore, setWorkflowBlockRow } =
    txWorkflowBlockResultPanelWorkspace;
  let panelDisplay = $derived($panelDisplayStateStore);

  $effect(() => {
    setWorkflowBlockRow(workflowBlockRow);
  });
</script>

<section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="text-sm font-semibold text-slate-900">
      {panelDisplay.headerDisplay.title}
    </div>
    <div class="text-xs text-slate-600">
      {panelDisplay.headerDisplay.committedLineText}
    </div>
  </div>
  <div class="mt-2 grid gap-2 text-xs text-slate-700 md:grid-cols-3">
    {#each panelDisplay.blockSummaryRows as blockSummaryRow}
      <div>{blockSummaryRow.labelText}: {blockSummaryRow.valueText}</div>
    {/each}
  </div>
  {#if panelDisplay.failureReasonDisplay.showSection}
    <div
      class="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
    >
      <div class="font-semibold">
        {panelDisplay.failureReasonDisplay.title}
      </div>
      <div class="mt-1 break-all">{panelDisplay.failureReasonDisplay.text}</div>
    </div>
    {#if panelDisplay.failureOutputDisplay.showSection}
      <div class="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
        <div class="text-[11px] font-semibold text-rose-700">
          {panelDisplay.failureOutputDisplay.title}
        </div>
        <OutputBlock class="mt-1"
          >{panelDisplay.failureOutputDisplay.text}</OutputBlock
        >
      </div>
    {/if}
  {/if}
  {#if panelDisplay.rollbackErrorsDisplay.showSection}
    <div
      class="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
    >
      {panelDisplay.rollbackErrorsDisplay.lineText}
    </div>
  {/if}
  {#if panelDisplay.failedBlockRollbackDisplay.showSection}
    <div
      class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
    >
      {panelDisplay.failedBlockRollbackDisplay.title}:
      {panelDisplay.failedBlockRollbackDisplay.rollbackAttemptedLineText}
      {panelDisplay.failedBlockRollbackDisplay.rollbackSucceededLineText}
      {#if panelDisplay.failedBlockRollbackDisplay.showRollbackErrors}
        <div class="mt-1">
          {panelDisplay.failedBlockRollbackDisplay.rollbackErrorsLineText}
        </div>
      {/if}
    </div>
  {/if}
  {#if panelDisplay.rollbackOutputsDisplay.showSection}
    <div class="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
      <div class="mb-2 text-sm font-semibold text-amber-700">
        {panelDisplay.rollbackOutputsDisplay.sectionTitle}
      </div>
      {#if panelDisplay.rollbackOutputsDisplay.showOperationSummary}
        <div class="mb-2 rounded-lg border border-amber-200 bg-white px-3 py-2">
          <div class="text-[11px] font-semibold text-slate-500">
            {panelDisplay.rollbackOutputsDisplay.commandLabelText}
          </div>
          <div class="mt-1 break-all font-mono text-xs text-slate-900">
            {panelDisplay.rollbackOutputsDisplay.operationSummaryText}
          </div>
        </div>
      {/if}
      <div class="grid gap-2">
        <div class="text-xs font-semibold text-slate-600">
          {panelDisplay.rollbackOutputsDisplay.stepRowsTitle}
        </div>
        {#each panelDisplay.rollbackOutputsDisplay.rollbackStepRows as operationStepRow}
          <TxOperationStepCard {operationStepRow} />
        {/each}
      </div>
    </div>
  {/if}
  {#if panelDisplay.stepDetailsDisplay.showStepRows}
    <div class="mt-3 grid gap-3">
      {#each panelDisplay.stepDetailsDisplay.stepResultRows as stepResultRow}
        <TxStepResultDetail {stepResultRow} />
      {/each}
    </div>
  {:else}
    <div
      class="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
    >
      {panelDisplay.stepDetailsDisplay.noStepDetailsMessage}
    </div>
  {/if}
</section>

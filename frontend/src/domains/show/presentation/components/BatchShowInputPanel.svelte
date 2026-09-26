<script lang="ts">
  import { BatchTargetFields } from "$domains/connections/presentation/components/fields/index.js";
  import ExecutionRunBar from "$components/fragments/ExecutionRunBar.svelte";
  import SessionRetryFields from "$components/fragments/SessionRetryFields.svelte";
  import StatusCard from "$components/fragments/StatusCard.svelte";
  import TextfsmControls from "$components/fragments/TextfsmControls.svelte";
  import { currentLanguageState, t } from "$lib/i18n.js";
  import { createBatchShowInputPanelWorkspace } from "../../application/createShowWorkspaces.js";
  import ShowObjectSelectionPanel from "./ShowObjectSelectionPanel.svelte";
  import type { Readable } from "svelte/store";

  type StoreValue<T> = T extends Readable<infer Value> ? Value : never;
  type PanelWorkspace = ReturnType<typeof createBatchShowInputPanelWorkspace>;
  type PanelDisplay = StoreValue<PanelWorkspace["panelDisplayStateStore"]>;

  let { active }: { active: boolean } = $props();
  const batchShowInputPanelWorkspace = createBatchShowInputPanelWorkspace();
  let i18nCurrentLanguage = $derived($currentLanguageState);
  let i18nLabels = $derived.by(() => {
    i18nCurrentLanguage;
    return {
      runTitle: t("showPanelConfigTitle"),
      footerHint: t("batchShowFooterHint"),
      targetsTitle: t("batchDeliveryTargetsTitle"),
      maxParallel: t("batchExecMaxParallelLabel"),
    };
  });
  const {
    changeBatchMaxParallel,
    changeBatchTargets,
    changeShowObject,
    changeShowObjectMode,
    changeSessionRetry,
    executeBatchShowPanel,
    panelDisplayStateStore,
    selectionDisplayStateStore,
    setPanelContext,
    textfsmActionHandlers,
  } = batchShowInputPanelWorkspace;

  let batchShowPanelDisplay: PanelDisplay = $derived($panelDisplayStateStore);
  let selectionDisplay = $derived($selectionDisplayStateStore);
  let batchShowInputDisplay = $derived(batchShowPanelDisplay.inputDisplay);
  let showSelectionFields = $derived(batchShowPanelDisplay.selectionFields);
  let showTextfsmFields = $derived(batchShowPanelDisplay.textfsmFields);
  let showRunButtonDisplay = $derived(batchShowPanelDisplay.runButtonDisplay);
  let retryState = $derived(batchShowPanelDisplay.retryState);

  $effect(() => {
    setPanelContext({ active, panelDisplay: batchShowPanelDisplay });
  });
</script>

<div hidden={!active}>
  <div class="flex min-w-0 flex-col gap-5 p-4 sm:p-5">
    <BatchTargetFields
      {active}
      title={i18nLabels.targetsTitle}
      hint={i18nLabels.footerHint}
      fields={batchShowInputDisplay.fields}
      maxParallel={showSelectionFields.maxParallel}
      maxParallelLabel={i18nLabels.maxParallel}
      onMaxParallelChange={changeBatchMaxParallel}
      onSelectionChange={changeBatchTargets}
    />

    {#if batchShowPanelDisplay.objectAvailability.canSelect}
      <ShowObjectSelectionPanel
        onModeChange={changeShowObjectMode}
        onObjectChange={changeShowObject}
        {selectionDisplay}
        {showSelectionFields}
      />
    {:else}
      <StatusCard
        message={batchShowPanelDisplay.objectAvailability.message}
        tone={batchShowPanelDisplay.objectAvailability.tone}
      />
    {/if}

    {#if active}
      <TextfsmControls
        hintKey="batchTextfsmParseHint"
        includeTemplateInput={false}
        onEnabledChange={textfsmActionHandlers.enabledChange}
        onAutoDownloadExcelChange={textfsmActionHandlers.autoDownloadExcelChange}
        onStrictErrorsChange={textfsmActionHandlers.strictErrorsChange}
        onTemplateChange={() => {}}
        textfsmFields={showTextfsmFields}
      />
    {/if}

    <SessionRetryFields
      idPrefix="batch-show-session-retry"
      value={retryState}
      onChange={changeSessionRetry}
    />

    <ExecutionRunBar
      docked={true}
      {active}
      autoDownloadOutput={showTextfsmFields.autoDownloadOutput}
      onAutoDownloadOutputChange={textfsmActionHandlers.autoDownloadOutputChange}
      title={i18nLabels.runTitle}
      hint={i18nLabels.footerHint}
      buttonLabel={showRunButtonDisplay.executeButtonLabel}
      loading={showRunButtonDisplay.executeLoading}
      disabled={!batchShowPanelDisplay.retryValid ||
        !batchShowPanelDisplay.objectAvailability.canSelect}
      onRun={executeBatchShowPanel}
    />
  </div>
</div>

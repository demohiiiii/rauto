<script lang="ts">
  import ExecutionResultMeta from "../../components/fragments/ExecutionResultMeta.svelte";
  import ExecutionResultsPanel from "../../components/fragments/ExecutionResultsPanel.svelte";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import OutputBlock from "../../components/fragments/OutputBlock.svelte";
  import ParsedOutputBlock from "../../components/fragments/ParsedOutputBlock.svelte";
  import TabList from "../../components/fragments/TabList.svelte";
  import { currentLanguageState, t } from "../../lib/i18n.js";
  import TerminalIcon from "@lucide/svelte/icons/terminal";
  import {
    createBatchShowResultsPanelWorkspace,
    createShowPageWorkspace,
  } from "$domains/show/index.js";
  import { exportParsedOutputItemExcel } from "../../modules/operations/results.js";
  import type { Readable } from "svelte/store";

  type StoreValue<T> = T extends Readable<infer Value> ? Value : never;
  type PageWorkspace = ReturnType<typeof createShowPageWorkspace>;
  type BatchResultDisplay = StoreValue<
    PageWorkspace["batchResultDisplayStateStore"]
  >;
  type BatchResultsPresentation = StoreValue<
    PageWorkspace["batchResultsPresentationStateStore"]
  >;

  let {
    batchResultDisplay,
    batchResultsPresentation,
  }: {
    batchResultDisplay: BatchResultDisplay;
    batchResultsPresentation: BatchResultsPresentation;
  } = $props();
  let i18nCurrentLanguage = $derived($currentLanguageState);
  let i18nLabels = $derived.by(() => {
    i18nCurrentLanguage;
    return {
      resultsTitle: t("showResultsTitle"),
      resultsHint: t("batchShowResultsHint"),
      resultCount: t("showResultCount"),
      devicesAria: t("batchShowResultDevicesAria"),
      objectsAria: t("batchShowResultObjectsAria"),
      rawOutputTab: t("showRawOutputTab"),
      parsedOutputTab: t("showParsedOutputTab"),
      succeeded: t("orchestrationStatusSuccess"),
      failed: t("orchestrationStatusFailed"),
    };
  });
  const batchShowResultsPanelWorkspace = createBatchShowResultsPanelWorkspace();
  const {
    exportActionHandlersStateStore,
    exportLoadingStateStore,
    setResultsContext,
  } = batchShowResultsPanelWorkspace;
  let exportActionHandlers = $derived($exportActionHandlersStateStore);
  let exportLoadingState = $derived($exportLoadingStateStore);
  let exportLoading = $derived(exportLoadingState.exportLoading);
  let activeResultKey = $state("");
  let resultView = $state("output");
  let deviceRows = $derived(batchResultsPresentation.deviceRows || []);
  let resultItems = $derived(
    deviceRows.flatMap((deviceRow) =>
      (deviceRow.objectRows || []).map((objectRow) => ({
        key: objectRow.resultKey,
        row: objectRow,
        title: deviceRow.targetText,
        subtitle: [objectRow.objectText, objectRow.modeText]
          .filter(Boolean)
          .join(" · "),
        statusLabel: objectRow.failed
          ? i18nLabels.failed
          : i18nLabels.succeeded,
        statusTone: objectRow.failed
          ? ("error" as const)
          : ("success" as const),
      })),
    ),
  );
  let activeResultItem = $derived(
    resultItems.find((item) => item.key === activeResultKey) ||
      resultItems[0] ||
      null,
  );
  let activeResultRow = $derived(activeResultItem?.row || null);
  let failedCount = $derived(
    resultItems.filter((item) => item.row.failed).length,
  );

  $effect(() => {
    setResultsContext({ batchResultsPresentation });
  });

  $effect(() => {
    if (!resultItems.length) {
      activeResultKey = "";
      resultView = "output";
      return;
    }
    if (!resultItems.some((item) => item.key === activeResultKey)) {
      activeResultKey = resultItems[0].key;
      resultView = "output";
    }
  });

  function selectResult(resultKey: string) {
    activeResultKey = resultKey;
    resultView = "output";
  }
</script>

{#snippet exportActions()}
  <LoadingButton
    variant="outline"
    size="sm"
    loading={exportLoading}
    onclick={exportActionHandlers.export}
  >
    <span>{batchResultsPresentation.exportButtonLabel}</span>
  </LoadingButton>
{/snippet}

<div class="grid min-w-0 max-w-full gap-4">
  {#if batchResultDisplay.showResultPanel || batchResultDisplay.statusMessage}
    <ExecutionResultsPanel
      title={i18nLabels.resultsTitle}
      description={i18nLabels.resultsHint}
      icon={TerminalIcon}
      items={resultItems}
      activeKey={activeResultKey}
      navigationAriaLabel={i18nLabels.devicesAria}
      onSelect={selectResult}
      statusMessage={batchResultDisplay.statusMessage}
      statusTone={batchResultDisplay.statusTone}
      totalCount={batchResultDisplay.showResultPanel
        ? batchResultsPresentation.resultCount
        : null}
      succeededCount={batchResultDisplay.showResultPanel
        ? batchResultsPresentation.resultCount - failedCount
        : null}
      failedCount={batchResultDisplay.showResultPanel ? failedCount : null}
      totalLabel={i18nLabels.resultCount}
      succeededLabel={i18nLabels.succeeded}
      failedLabel={i18nLabels.failed}
      actions={batchResultsPresentation.exportAvailable
        ? exportActions
        : undefined}
    >
      {#snippet detail()}
        {#if activeResultRow}
          <ExecutionResultMeta fields={activeResultRow.metaFields} />
          <TabList
            tabItems={[
              { value: "output", label: i18nLabels.rawOutputTab },
              { value: "parsed", label: i18nLabels.parsedOutputTab },
            ]}
            activeValue={resultView}
            aria-label={i18nLabels.objectsAria}
            onSelect={(view) => (resultView = view)}
          />
          {#if resultView === "output"}
            <OutputBlock
              title={activeResultRow.outputTitle}
              tone={activeResultRow.failed ? "error" : "default"}
              errorLabel={i18nLabels.failed}
            >
              {activeResultRow.outputText}
            </OutputBlock>
          {:else}
            <ParsedOutputBlock
              parsedOutputBlock={activeResultRow.parsedOutputBlock}
              onExportExcel={exportParsedOutputItemExcel}
            />
          {/if}
        {/if}
      {/snippet}
    </ExecutionResultsPanel>
  {/if}
</div>

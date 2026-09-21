<script lang="ts">
  import ExecutionResultMeta from "$components/fragments/ExecutionResultMeta.svelte";
  import ExecutionResultsPanel from "$components/fragments/ExecutionResultsPanel.svelte";
  import LoadingButton from "$components/fragments/LoadingButton.svelte";
  import OutputBlock from "$components/fragments/OutputBlock.svelte";
  import ParsedOutputBlock from "$components/fragments/ParsedOutputBlock.svelte";
  import TabList from "$components/fragments/TabList.svelte";
  import * as Tabs from "$lib/components/ui/tabs/index.js";
  import { currentLanguageState, t } from "$lib/i18n.js";
  import CircleXIcon from "@lucide/svelte/icons/circle-x";
  import TerminalIcon from "@lucide/svelte/icons/terminal";
  import {
    createBatchShowResultsPanelWorkspace,
    createShowPageWorkspace,
  } from "../../application/createShowWorkspaces.js";
  import { exportParsedOutputItemExcel } from "$domains/execution/index.js";
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
      downloadOutput: t("downloadCommandOutput"),
      resultsHint: t("batchShowResultsHint"),
      resultCount: t("showResultCount"),
      devicesAria: t("batchShowResultDevicesAria"),
      objectsAria: t("batchShowResultObjectsAria"),
      resultViewAria: t("showResultViewAria"),
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
  let activeDeviceKey = $state("");
  let activeResultKey = $state("");
  let resultView = $state("output");
  let deviceRows = $derived(batchResultsPresentation.deviceRows || []);
  let deviceItems = $derived(
    deviceRows.map((deviceRow) => {
      const failed = deviceRow.objectRows.some((row) => row.failed);
      return {
        key: deviceRow.deviceKey,
        row: deviceRow,
        title: deviceRow.targetText,
        subtitle: deviceRow.profileText,
        statusLabel: failed ? i18nLabels.failed : i18nLabels.succeeded,
        statusTone: failed ? ("error" as const) : ("success" as const),
      };
    }),
  );
  let activeDeviceItem = $derived(
    deviceItems.find((item) => item.key === activeDeviceKey) ||
      deviceItems[0] ||
      null,
  );
  let objectRows = $derived(activeDeviceItem?.row.objectRows || []);
  let activeResultRow = $derived(
    objectRows.find((row) => row.resultKey === activeResultKey) ||
      objectRows[0] ||
      null,
  );
  let failedCount = $derived(
    batchResultsPresentation.resultRows.filter((row) => row.failed).length,
  );

  $effect(() => {
    setResultsContext({ batchResultsPresentation });
  });

  $effect(() => {
    if (!deviceItems.some((item) => item.key === activeDeviceKey)) {
      activeDeviceKey = deviceItems[0]?.key || "";
      activeResultKey = "";
      resultView = "output";
    }
    if (!objectRows.some((row) => row.resultKey === activeResultKey)) {
      activeResultKey = objectRows[0]?.resultKey || "";
      resultView = "output";
    }
  });

  function selectDevice(deviceKey: string) {
    activeDeviceKey = deviceKey;
    activeResultKey = "";
    resultView = "output";
  }

  function selectResult(resultKey: string) {
    activeResultKey = resultKey;
    resultView = "output";
  }
</script>

{#snippet exportActions()}
  <LoadingButton
    variant="outline"
    size="sm"
    onclick={exportActionHandlers.downloadOutput}
    >{i18nLabels.downloadOutput}</LoadingButton
  >
  {#if batchResultsPresentation.exportAvailable}
    <LoadingButton
      variant="outline"
      size="sm"
      loading={exportLoading}
      onclick={exportActionHandlers.export}
    >
      <span>{batchResultsPresentation.exportButtonLabel}</span>
    </LoadingButton>
  {/if}
{/snippet}

<div class="grid min-w-0 max-w-full gap-4">
  {#if batchResultDisplay.showResultPanel || batchResultDisplay.statusMessage}
    <ExecutionResultsPanel
      title={i18nLabels.resultsTitle}
      description={i18nLabels.resultsHint}
      icon={TerminalIcon}
      items={deviceItems}
      activeKey={activeDeviceKey}
      alwaysShowNavigation={true}
      navigationAriaLabel={i18nLabels.devicesAria}
      onSelect={selectDevice}
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
      actions={batchResultsPresentation.resultCount ? exportActions : undefined}
    >
      {#snippet detail()}
        {#if activeResultRow}
          <Tabs.Root
            value={activeResultRow.resultKey}
            onValueChange={selectResult}
            class="min-w-0 gap-4"
          >
            <div class="min-w-0 overflow-x-auto">
              <Tabs.List aria-label={i18nLabels.objectsAria}>
                {#each objectRows as row (row.resultKey)}
                  <Tabs.Trigger value={row.resultKey} title={row.command}>
                    {row.objectText}
                    {#if row.failed}
                      <CircleXIcon
                        class="size-4 text-destructive"
                        aria-hidden="true"
                      />
                      <span class="sr-only">{i18nLabels.failed}</span>
                    {/if}
                  </Tabs.Trigger>
                {/each}
              </Tabs.List>
            </div>
            {#each objectRows as row (row.resultKey)}
              <Tabs.Content value={row.resultKey} class="min-w-0 space-y-4">
                <ExecutionResultMeta fields={row.metaFields} />
                {#if batchResultDisplay.textfsmEnabled}
                  <TabList
                    tabItems={[
                      { value: "output", label: i18nLabels.rawOutputTab },
                      { value: "parsed", label: i18nLabels.parsedOutputTab },
                    ]}
                    activeValue={resultView}
                    aria-label={i18nLabels.resultViewAria}
                    onSelect={(view) => (resultView = view)}
                  />
                {/if}
                {#if !batchResultDisplay.textfsmEnabled || resultView === "output"}
                  <OutputBlock
                    title={row.outputTitle}
                    tone={row.failed ? "error" : "default"}
                    errorLabel={i18nLabels.failed}
                  >
                    {row.outputText}
                  </OutputBlock>
                {:else}
                  <ParsedOutputBlock
                    parsedOutputBlock={row.parsedOutputBlock}
                    onExportExcel={exportParsedOutputItemExcel}
                  />
                {/if}
              </Tabs.Content>
            {/each}
          </Tabs.Root>
        {/if}
      {/snippet}
    </ExecutionResultsPanel>
  {/if}
</div>

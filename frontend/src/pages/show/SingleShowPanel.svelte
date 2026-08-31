<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import ExecutionResultMeta from "../../components/fragments/ExecutionResultMeta.svelte";
  import ExecutionResultsPanel from "../../components/fragments/ExecutionResultsPanel.svelte";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import OutputBlock from "../../components/fragments/OutputBlock.svelte";
  import ParsedOutputBlock from "../../components/fragments/ParsedOutputBlock.svelte";
  import SessionRetryFields from "../../components/fragments/SessionRetryFields.svelte";
  import TabList from "../../components/fragments/TabList.svelte";
  import TextfsmControls from "../../components/fragments/TextfsmControls.svelte";
  import WorkspaceActionHeader from "../../components/fragments/WorkspaceActionHeader.svelte";
  import SearchIcon from "@lucide/svelte/icons/search";
  import { currentLanguageState, t } from "../../lib/i18n.js";
  import TerminalIcon from "@lucide/svelte/icons/terminal";
  import { createSingleShowPanelWorkspace } from "$domains/show/index.js";
  import { exportParsedOutputItemExcel } from "../../modules/operations/results.js";
  import ShowObjectSelectionPanel from "./ShowObjectSelectionPanel.svelte";
  import type { Readable } from "svelte/store";

  type StoreValue<T> = T extends Readable<infer Value> ? Value : never;
  type PanelWorkspace = ReturnType<typeof createSingleShowPanelWorkspace>;
  type PanelDisplay = StoreValue<PanelWorkspace["panelDisplayStateStore"]>;

  interface Props {
    active: boolean;
    currentTab?: string;
    onSelectQuery: (query: string) => unknown;
    queryAriaLabel?: string;
    tabItems?: Array<{ label?: string; labelKey?: string; value: string }>;
  }

  let {
    active,
    currentTab = "",
    onSelectQuery,
    queryAriaLabel = "",
    tabItems = [],
  }: Props = $props();
  const singleShowPanelWorkspace = createSingleShowPanelWorkspace();
  let i18nCurrentLanguage = $derived($currentLanguageState);
  let i18nLabels = $derived.by(() => {
    i18nCurrentLanguage;
    return {
      configTitle: t("showPanelConfigTitle"),
      configHint: t("showPanelConfigHint"),
      footerHint: t("showFooterHint"),
      resultsHint: t("showResultsHint"),
      resultCount: t("showResultCount"),
      resultObjectsAria: t("showResultObjectsAria"),
      rawOutputTab: t("showRawOutputTab"),
      parsedOutputTab: t("showParsedOutputTab"),
      succeeded: t("orchestrationStatusSuccess"),
      failed: t("orchestrationStatusFailed"),
    };
  });
  const {
    changeShowObject,
    changeShowObjectMode,
    changeSessionRetry,
    executeSingleShow,
    exportActionHandlersStateStore,
    exportLoadingStateStore,
    panelDisplayStateStore,
    selectionDisplayStateStore,
    setPanelContext,
    textfsmActionHandlers,
  } = singleShowPanelWorkspace;

  let singleShowPanelDisplay: PanelDisplay = $derived($panelDisplayStateStore);
  let selectionDisplay = $derived($selectionDisplayStateStore);
  let exportActionHandlers = $derived($exportActionHandlersStateStore);
  let exportLoadingState = $derived($exportLoadingStateStore);
  let showSelectionFields = $derived(singleShowPanelDisplay.selectionFields);
  let showTextfsmFields = $derived(singleShowPanelDisplay.textfsmFields);
  let singleShowResults = $derived(singleShowPanelDisplay.resultsDisplay);
  let showRunButtonDisplay = $derived(singleShowPanelDisplay.runButtonDisplay);
  let retryState = $derived(singleShowPanelDisplay.retryState);
  let activeResultKey = $state("");
  let resultView = $state("output");
  let resultRows = $derived(singleShowResults.resultRows || []);
  let showResultRow = $derived(
    resultRows.find((resultRow) => resultRow.resultKey === activeResultKey) ||
      resultRows[0] ||
      null,
  );
  let resultItems = $derived(
    resultRows.map((row) => ({
      key: row.resultKey,
      title: row.objectText,
      subtitle: row.modeText,
      statusLabel: row.failed ? i18nLabels.failed : i18nLabels.succeeded,
      statusTone: row.failed ? ("error" as const) : ("success" as const),
    })),
  );
  let failedCount = $derived(resultRows.filter((row) => row.failed).length);

  $effect(() => {
    setPanelContext({ active, panelDisplay: singleShowPanelDisplay });
  });

  $effect(() => {
    if (!resultRows.length) {
      activeResultKey = "";
      resultView = "output";
      return;
    }
    if (
      resultRows.some((resultRow) => resultRow.resultKey === activeResultKey)
    ) {
      return;
    }
    activeResultKey = resultRows[0].resultKey;
    resultView = "output";
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
    loading={exportLoadingState.exportLoading}
    onclick={exportActionHandlers.export}
  >
    <span>{singleShowResults.exportButtonLabel}</span>
  </LoadingButton>
{/snippet}

<div class="flex flex-col gap-3" hidden={!active}>
  <Card.Root class="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
    <WorkspaceActionHeader
      title={i18nLabels.configTitle}
      description={i18nLabels.configHint}
      icon={SearchIcon}
    >
      {#snippet actions()}
        <TabList
          {tabItems}
          activeValue={currentTab}
          aria-label={queryAriaLabel}
          themeAware={true}
          onSelect={onSelectQuery}
        />
      {/snippet}
    </WorkspaceActionHeader>
    <Card.Content class="flex flex-col gap-5 p-4 sm:p-5">
      <ShowObjectSelectionPanel
        onModeChange={changeShowObjectMode}
        onObjectChange={changeShowObject}
        {selectionDisplay}
        {showSelectionFields}
      />

      {#if active}
        <TextfsmControls
          excelNamePlaceholderKey="batchShowExcelNamePlaceholder"
          hintKey="textfsmParseHint"
          includeTemplateInput={true}
          onEnabledChange={textfsmActionHandlers.enabledChange}
          onExcelNameChange={() => {}}
          onPlatformChange={textfsmActionHandlers.platformChange}
          onStrictErrorsChange={textfsmActionHandlers.strictErrorsChange}
          onTemplateChange={textfsmActionHandlers.templateChange}
          textfsmFields={showTextfsmFields}
        />
      {/if}

      <SessionRetryFields
        idPrefix="single-show-session-retry"
        value={retryState}
        onChange={changeSessionRetry}
      />

      <div
        class="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 px-4 py-3"
      >
        <p class="text-xs text-muted-foreground">
          {i18nLabels.footerHint}
        </p>
        <LoadingButton
          variant="default"
          size="lg"
          loading={showRunButtonDisplay.executeLoading}
          disabled={!singleShowPanelDisplay.retryValid}
          onclick={executeSingleShow}
        >
          <span>{showRunButtonDisplay.executeButtonLabel}</span>
        </LoadingButton>
      </div>
    </Card.Content>
  </Card.Root>

  {#if singleShowResults.resultCount || singleShowResults.statusMessage}
    <ExecutionResultsPanel
      title={singleShowResults.title}
      description={i18nLabels.resultsHint}
      icon={TerminalIcon}
      items={resultItems}
      activeKey={activeResultKey}
      navigationAriaLabel={i18nLabels.resultObjectsAria}
      onSelect={selectResult}
      statusMessage={singleShowResults.statusMessage}
      statusTone={singleShowResults.statusTone}
      totalCount={singleShowResults.resultCount}
      succeededCount={singleShowResults.resultCount - failedCount}
      {failedCount}
      totalLabel={i18nLabels.resultCount}
      succeededLabel={i18nLabels.succeeded}
      failedLabel={i18nLabels.failed}
      actions={singleShowResults.exportAvailable ? exportActions : undefined}
    >
      {#snippet detail()}
        {#if showResultRow}
          <ExecutionResultMeta fields={showResultRow.metaFields} />
          <TabList
            tabItems={[
              { value: "output", label: i18nLabels.rawOutputTab },
              { value: "parsed", label: i18nLabels.parsedOutputTab },
            ]}
            activeValue={resultView}
            aria-label={i18nLabels.resultsHint}
            onSelect={(view) => (resultView = view)}
          />
          {#if resultView === "output"}
            <OutputBlock
              title={showResultRow.outputTitle}
              tone={showResultRow.failed ? "error" : "default"}
              errorLabel={i18nLabels.failed}
            >
              {showResultRow.outputText}
            </OutputBlock>
          {:else}
            <ParsedOutputBlock
              parsedOutputBlock={showResultRow.parsedOutputBlock}
              onExportExcel={exportParsedOutputItemExcel}
            />
          {/if}
        {/if}
      {/snippet}
    </ExecutionResultsPanel>
  {/if}
</div>

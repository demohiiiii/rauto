<script>
  import * as Card from "$lib/components/ui/card";
  import DetailFieldCard from "../../components/fragments/DetailFieldCard.svelte";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import OutputBlock from "../../components/fragments/OutputBlock.svelte";
  import ParsedOutputBlock from "../../components/fragments/ParsedOutputBlock.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import TabList from "../../components/fragments/TabList.svelte";
  import TextfsmControls from "../../components/fragments/TextfsmControls.svelte";
  import WorkspaceActionHeader from "../../components/fragments/WorkspaceActionHeader.svelte";
  import SearchIcon from "@lucide/svelte/icons/search";
  import { currentLanguageState, t } from "../../lib/i18n.js";
  import Table2Icon from "@lucide/svelte/icons/table-2";
  import TerminalIcon from "@lucide/svelte/icons/terminal";
  import { exportParsedOutputItemExcel } from "../../modules/operations/results.js";
  import { createSingleShowPanelWorkspace } from "../../modules/operations/showQueryWorkspaces.js";
  import ShowObjectSelectionPanel from "./ShowObjectSelectionPanel.svelte";

  let {
    active,
    currentTab = "",
    onSelectQuery,
    queryAriaLabel = "",
    tabItems = [],
  } = $props();
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
    };
  });
  const {
    changeShowObject,
    changeShowObjectMode,
    executeSingleShow,
    exportActionHandlersStateStore,
    exportLoadingStateStore,
    panelDisplayStateStore,
    selectionDisplayStateStore,
    setPanelContext,
    textfsmActionHandlers,
  } = singleShowPanelWorkspace;

  let singleShowPanelDisplay = $derived($panelDisplayStateStore);
  let selectionDisplay = $derived($selectionDisplayStateStore);
  let exportActionHandlers = $derived($exportActionHandlersStateStore);
  let exportLoadingState = $derived($exportLoadingStateStore);
  let showSelectionFields = $derived(singleShowPanelDisplay.selectionFields);
  let showTextfsmFields = $derived(singleShowPanelDisplay.textfsmFields);
  let singleShowResults = $derived(singleShowPanelDisplay.resultsDisplay);
  let showRunButtonDisplay = $derived(singleShowPanelDisplay.runButtonDisplay);
  let activeResultKey = $state("");
  let resultView = $state("output");
  let resultRows = $derived(singleShowResults.resultRows || []);
  let showResultRow = $derived(
    resultRows.find((resultRow) => resultRow.resultKey === activeResultKey) ||
      resultRows[0] ||
      null,
  );

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

  function selectResult(resultKey) {
    activeResultKey = resultKey;
    resultView = "output";
  }
</script>

<div class="flex flex-col gap-3" hidden={!active}>
  <Card.Root class="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
    <WorkspaceActionHeader
      title={i18nLabels.configTitle}
      description={i18nLabels.configHint}
      icon={SearchIcon}
    />
    <Card.Content class="flex flex-col gap-5 p-4 sm:p-5">
      <TabList
        {tabItems}
        activeValue={currentTab}
        aria-label={queryAriaLabel}
        rootClass="w-fit"
        onSelect={onSelectQuery}
      />

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
          onPlatformChange={textfsmActionHandlers.platformChange}
          onStrictErrorsChange={textfsmActionHandlers.strictErrorsChange}
          onTemplateChange={textfsmActionHandlers.templateChange}
          textfsmFields={showTextfsmFields}
        />
      {/if}

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
          onclick={executeSingleShow}
        >
          <span>{showRunButtonDisplay.executeButtonLabel}</span>
        </LoadingButton>
      </div>
    </Card.Content>
  </Card.Root>

  {#if singleShowResults.resultCount || singleShowResults.statusMessage}
    <Card.Root class="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
      <WorkspaceActionHeader
        title={singleShowResults.title}
        description={i18nLabels.resultsHint}
        icon={TerminalIcon}
      >
        {#snippet actions()}
          <div class="flex items-center gap-2">
            <span
              class="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
            >
              {i18nLabels.resultCount}
              <span class="font-semibold text-foreground">
                {singleShowResults.resultCount}
              </span>
            </span>
            {#if singleShowResults.exportAvailable}
              <LoadingButton
                variant="outline"
                size="sm"
                loading={exportLoadingState.exportLoading}
                onclick={exportActionHandlers.export}
              >
                <span>{singleShowResults.exportButtonLabel}</span>
              </LoadingButton>
            {/if}
          </div>
        {/snippet}
      </WorkspaceActionHeader>

      {#if singleShowResults.resultCount && resultRows.length > 1}
        <div
          class="flex items-center gap-1 overflow-x-auto border-b border-border px-6 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label={i18nLabels.resultObjectsAria}
        >
          {#each resultRows as resultRow}
            <button
              type="button"
              class={[
                "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 font-mono text-sm font-medium transition-colors",
                resultRow.resultKey === activeResultKey
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              ]}
              aria-pressed={resultRow.resultKey === activeResultKey}
              onclick={() => selectResult(resultRow.resultKey)}
            >
              {resultRow.objectText}
              <span
                class={[
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  resultRow.resultKey === activeResultKey
                    ? "bg-accent text-accent-foreground"
                    : "bg-secondary text-muted-foreground",
                ]}
              >
                {resultRow.modeText}
              </span>
            </button>
          {/each}
        </div>
      {/if}

      <div class="flex flex-col gap-4 p-4 sm:p-5">
        {#if singleShowResults.statusMessage}
          <StatusCard
            message={singleShowResults.statusMessage}
            tone={singleShowResults.statusTone}
          />
        {/if}

        {#if showResultRow}
          <div
            class="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-border bg-muted/30 px-4 py-3"
          >
            {#each showResultRow.metaFields as metaField}
              <DetailFieldCard
                detailValue={metaField.value}
                label={metaField.label}
                mono={metaField.mono}
                variant="inline"
                class="text-muted-foreground"
                labelClass="text-muted-foreground/70"
                valueClass={metaField.mono
                  ? "break-all font-mono font-medium text-foreground"
                  : "break-all font-medium text-foreground"}
              />
            {/each}
          </div>

          <div class="flex items-center justify-between gap-3">
            <div class="inline-flex items-center rounded-lg bg-secondary p-0.5">
              <button
                type="button"
                class={[
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                  resultView === "output"
                    ? "bg-card text-card-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                ]}
                onclick={() => (resultView = "output")}
              >
                <TerminalIcon class="size-3.5" />
                {i18nLabels.rawOutputTab}
              </button>
              <button
                type="button"
                class={[
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                  resultView === "parsed"
                    ? "bg-card text-card-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                ]}
                onclick={() => (resultView = "parsed")}
              >
                <Table2Icon class="size-3.5" />
                {i18nLabels.parsedOutputTab}
              </button>
            </div>
          </div>

          {#if resultView === "output"}
            <OutputBlock title={showResultRow.outputTitle}>
              {showResultRow.outputText}
            </OutputBlock>
          {:else}
            <ParsedOutputBlock
              parsedOutputBlock={showResultRow.parsedOutputBlock}
              onExportExcel={exportParsedOutputItemExcel}
            />
          {/if}
        {/if}
      </div>
    </Card.Root>
  {/if}
</div>

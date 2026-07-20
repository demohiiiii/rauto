<script>
  import * as Card from "$lib/components/ui/card";
  import DetailFieldCard from "../../components/fragments/DetailFieldCard.svelte";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import OutputBlock from "../../components/fragments/OutputBlock.svelte";
  import ParsedOutputBlock from "../../components/fragments/ParsedOutputBlock.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import TabList from "../../components/fragments/TabList.svelte";
  import TextfsmControls from "../../components/fragments/TextfsmControls.svelte";
  import SearchIcon from "@lucide/svelte/icons/search";
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

<div class="flex flex-col gap-6" hidden={!active}>
  <Card.Root class="overflow-hidden rounded-3xl border-border shadow-sm">
    <Card.Header
      class="flex flex-row items-center justify-between gap-3 border-b border-border px-6 py-4 [.border-b]:pb-4"
    >
      <div class="flex items-center gap-3">
        <span
          class="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15"
          aria-hidden="true"
        >
          <SearchIcon class="size-4" />
        </span>
        <span>
          <Card.Title class="text-[15px]">查询配置</Card.Title>
          <Card.Description>选择查询对象并配置解析选项</Card.Description>
        </span>
      </div>
    </Card.Header>
    <Card.Content class="flex flex-col gap-6 p-6">
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
          配置完成后，将在当前目标设备上执行只读查询。
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
    <section
      class="min-w-0 overflow-hidden rounded-3xl border border-border bg-card shadow-sm"
    >
      <div
        class="flex items-center justify-between gap-3 border-b border-border px-6 py-4"
      >
        <div class="flex items-center gap-3">
          <span
            class="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15"
            aria-hidden="true"
          >
            <TerminalIcon class="size-4" />
          </span>
          <span>
            <h3 class="text-[15px] font-semibold text-card-foreground">
              {singleShowResults.title}
            </h3>
            <p class="text-xs text-muted-foreground">
              每个查询对象的原始输出与解析结果
            </p>
          </span>
        </div>

        <div class="flex items-center gap-2">
          <span
            class="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
          >
            结果数
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
      </div>

      {#if singleShowResults.resultCount && resultRows.length > 1}
        <div
          class="flex items-center gap-1 overflow-x-auto border-b border-border px-6 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="查询结果对象"
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

      <div class="flex flex-col gap-4 p-6">
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
                命令行输出
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
                TextFSM 解析
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
    </section>
  {/if}
</div>

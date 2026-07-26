<script>
  import * as Card from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import ConnectionPickerField from "../../components/connections/ConnectionPickerField.svelte";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import TabList from "../../components/fragments/TabList.svelte";
  import TextfsmControls from "../../components/fragments/TextfsmControls.svelte";
  import WorkspaceActionHeader from "../../components/fragments/WorkspaceActionHeader.svelte";
  import SearchIcon from "@lucide/svelte/icons/search";
  import { createBatchShowInputPanelWorkspace } from "../../modules/operations/showQueryWorkspaces.js";
  import ShowObjectSelectionPanel from "./ShowObjectSelectionPanel.svelte";

  let {
    active,
    currentTab = "",
    onSelectQuery,
    queryAriaLabel = "",
    tabItems = [],
  } = $props();
  const batchShowInputPanelWorkspace = createBatchShowInputPanelWorkspace();
  const {
    changeBatchMaxParallel,
    changeShowObject,
    changeShowObjectMode,
    executeBatchShowPanel,
    panelDisplayStateStore,
    selectionDisplayStateStore,
    setPanelContext,
    textfsmActionHandlers,
  } = batchShowInputPanelWorkspace;

  let batchShowPanelDisplay = $derived($panelDisplayStateStore);
  let selectionDisplay = $derived($selectionDisplayStateStore);
  let batchShowInputDisplay = $derived(batchShowPanelDisplay.inputDisplay);
  let showSelectionFields = $derived(batchShowPanelDisplay.selectionFields);
  let showTextfsmFields = $derived(batchShowPanelDisplay.textfsmFields);
  let showRunButtonDisplay = $derived(batchShowPanelDisplay.runButtonDisplay);

  $effect(() => {
    setPanelContext({ active, panelDisplay: batchShowPanelDisplay });
  });
</script>

<div hidden={!active}>
  <Card.Root class="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
    <WorkspaceActionHeader
      title="查询配置"
      description="选择查询对象并配置解析选项"
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
          hintKey="batchTextfsmParseHint"
          includeTemplateInput={false}
          onEnabledChange={textfsmActionHandlers.enabledChange}
          onExcelNameChange={textfsmActionHandlers.excelNameChange}
          onPlatformChange={textfsmActionHandlers.platformChange}
          onStrictErrorsChange={textfsmActionHandlers.strictErrorsChange}
          textfsmFields={showTextfsmFields}
        />
      {/if}

      <div class="rounded-2xl border border-border bg-muted/30 p-4">
        <div class="mb-3 text-sm font-medium text-foreground">
          {batchShowInputDisplay.targetsLabel}
        </div>
        <div
          class="grid gap-4 md:grid-cols-2"
          role="group"
          aria-label={batchShowInputDisplay.targetsLabel}
        >
          {#each batchShowInputDisplay.fields as targetField (targetField.key)}
            <ConnectionPickerField
              keyName={targetField.keyName}
              labelText={targetField.labelText}
              pickerPlaceholder={targetField.pickerPlaceholder}
            />
          {/each}
        </div>
      </div>

      <div
        class="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 px-4 py-3"
      >
        <p class="text-xs text-muted-foreground">
          批量查询会按目标、分组或标签展开后并行执行。
        </p>
        <div class="flex items-center gap-3">
          <label
            class="flex items-center gap-2 text-xs whitespace-nowrap text-muted-foreground"
            for="batch-show-max-parallel"
          >
            并发数
            <Input
              id="batch-show-max-parallel"
              type="number"
              min="1"
              step="1"
              placeholder="4"
              class="h-8 w-20"
              value={showSelectionFields.maxParallel}
              oninput={(event) =>
                changeBatchMaxParallel(event.currentTarget.value)}
            />
          </label>
          <LoadingButton
            size="lg"
            loading={showRunButtonDisplay.executeLoading}
            onclick={executeBatchShowPanel}
          >
            <span>{showRunButtonDisplay.executeButtonLabel}</span>
          </LoadingButton>
        </div>
      </div>
    </Card.Content>
  </Card.Root>
</div>

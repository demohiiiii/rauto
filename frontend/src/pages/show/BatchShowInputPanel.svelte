<script>
  import * as Card from "$lib/components/ui/card";
  import ConnectionPickerField from "../../components/connections/ConnectionPickerField.svelte";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import TabList from "../../components/fragments/TabList.svelte";
  import TextfsmControls from "../../components/fragments/TextfsmControls.svelte";
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
          批量查询会按目标、分组或标签展开后依次执行。
        </p>
        <LoadingButton
          size="lg"
          loading={showRunButtonDisplay.executeLoading}
          onclick={executeBatchShowPanel}
        >
          <span>{showRunButtonDisplay.executeButtonLabel}</span>
        </LoadingButton>
      </div>
    </Card.Content>
  </Card.Root>
</div>

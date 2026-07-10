<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import EventEntriesTable from "../fragments/EventEntriesTable.svelte";
  import PlainCheckboxField from "../fragments/PlainCheckboxField.svelte";
  import PlainInputField from "../fragments/PlainInputField.svelte";
  import PlainTextAreaField from "../fragments/PlainTextAreaField.svelte";
  import SummaryMetricCard from "../fragments/SummaryMetricCard.svelte";
  import StatusCard from "../fragments/StatusCard.svelte";
  import TabList from "../fragments/TabList.svelte";
  import ValueLabelSelectField from "../fragments/ValueLabelSelectField.svelte";
  import { createRecordDrawerContentWorkspace } from "../../modules/overlays.js";

  let {
    drawerContentDisplay,
    onCopyRecording,
    onEventKindChange,
    onFailedOnlyChange,
    onModeSelect,
    onOpenEntryIndex,
    onRawInput,
    onRecordLevelChange,
    onResetFilters,
    onSearchInput,
    onUseInReplay,
  } = $props();

  function handleEventKindChange(eventKindValue) {
    if (typeof onEventKindChange === "function") {
      return onEventKindChange(eventKindValue);
    }
    return undefined;
  }

  function handleFailedOnlyChange(failedOnlyValue) {
    if (typeof onFailedOnlyChange === "function") {
      return onFailedOnlyChange(failedOnlyValue);
    }
    return undefined;
  }

  function handleRawInput(rawValue) {
    if (typeof onRawInput === "function") {
      return onRawInput(rawValue);
    }
    return undefined;
  }

  function handleRecordLevelChange(recordLevelValue) {
    if (typeof onRecordLevelChange === "function") {
      return onRecordLevelChange(recordLevelValue);
    }
    return undefined;
  }

  function handleSearchInput(searchValue) {
    if (typeof onSearchInput === "function") {
      return onSearchInput(searchValue);
    }
    return undefined;
  }

  let contentDisplay = $derived(drawerContentDisplay.content);
  let controlsDisplay = $derived(drawerContentDisplay.controls);
  const recordDrawerContentWorkspace = createRecordDrawerContentWorkspace({
    onEventKindChange: handleEventKindChange,
    onFailedOnlyChange: handleFailedOnlyChange,
    onRawInput: handleRawInput,
    onRecordLevelChange: handleRecordLevelChange,
    onSearchInput: handleSearchInput,
  });
  const {
    recordEventKindChangeHandler,
    recordFailedOnlyChangeHandler,
    recordLevelChangeHandler,
    recordRawInputChangeHandler,
    recordSearchInputChangeHandler,
  } = recordDrawerContentWorkspace;
</script>

<div class="grid min-h-0 flex-1 gap-3 overflow-y-auto overscroll-contain p-4">
  <div class="rounded-xl border border-border bg-card p-4 shadow-xs">
    <div
      class="flex flex-wrap items-center justify-between gap-3 max-lg:items-stretch"
    >
      <div class="inline-flex flex-wrap items-center gap-2.5">
        <ValueLabelSelectField
          class="md:w-55"
          title={controlsDisplay.recordLevelHint}
          aria-label={controlsDisplay.recordLevelLabel}
          value={controlsDisplay.recordLevel}
          optionRows={controlsDisplay.recordLevelOptionRows}
          onValueChange={recordLevelChangeHandler()}
        />
      </div>
      <div class="inline-flex flex-wrap items-center gap-2.5">
        <span class="text-sm font-semibold text-muted-foreground">
          {controlsDisplay.displayModeLabel}
        </span>
        <TabList
          tabItems={controlsDisplay.modeTabs}
          activeValue={controlsDisplay.displayMode}
          aria-label={controlsDisplay.displayModeLabel}
          onSelect={onModeSelect}
        />
      </div>
    </div>
  </div>
  <div class="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
    <div
      class="flex flex-wrap items-center justify-between gap-3 max-lg:items-stretch"
    >
      <PlainCheckboxField
        checked={controlsDisplay.failedOnly}
        labelText={controlsDisplay.failedOnlyLabel}
        title={controlsDisplay.failedOnlyLabel}
        onCheckedChange={recordFailedOnlyChangeHandler()}
      />
      <ValueLabelSelectField
        class="w-55"
        title={controlsDisplay.eventKindLabel}
        aria-label={controlsDisplay.eventKindLabel}
        value={controlsDisplay.eventKind}
        optionRows={controlsDisplay.eventKindOptionRows}
        onValueChange={recordEventKindChangeHandler()}
      />
    </div>
    <div
      class="flex flex-wrap items-center justify-between gap-3 max-lg:items-stretch"
    >
      <PlainInputField
        class="w-65"
        aria-label={controlsDisplay.searchField.ariaLabelText}
        placeholderText={controlsDisplay.searchField.placeholder}
        value={controlsDisplay.searchField.value}
        onValueInput={recordSearchInputChangeHandler()}
      />
      <Button
        variant="outline"
        size="sm"
        type="button"
        onclick={onResetFilters}
      >
        {controlsDisplay.clearButtonLabel}
      </Button>
    </div>
  </div>
  <div class="rounded-xl border border-border bg-card p-4 shadow-xs">
    <div class="inline-flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        type="button"
        onclick={onCopyRecording}
      >
        {controlsDisplay.copyButtonLabel}
      </Button>
      <Button variant="outline" size="sm" type="button" onclick={onUseInReplay}>
        {controlsDisplay.useReplayButtonLabel}
      </Button>
    </div>
  </div>
  <div class="rounded-xl border border-border bg-card p-4 shadow-xs">
    <div class="grid gap-3" hidden={!contentDisplay.showListPanel}>
      {#if contentDisplay.parseError}
        <StatusCard
          message={contentDisplay.parseError}
          tone={contentDisplay.parseErrorStatus.tone}
        />
      {:else if !contentDisplay.hasEntries}
        <StatusCard message={contentDisplay.emptyText} />
      {:else}
        <div class="grid gap-2 md:grid-cols-4">
          {#each contentDisplay.statCards as statCardRow}
            <SummaryMetricCard
              label={statCardRow.labelText}
              metricValue={statCardRow.statValue}
              size="lg"
            />
          {/each}
        </div>
        <EventEntriesTable
          entryRows={contentDisplay.entryRows}
          {onOpenEntryIndex}
          tableHeaderCells={contentDisplay.tableHeaderCells}
        />
      {/if}
    </div>
    <PlainTextAreaField
      class="min-h-28 font-mono"
      aria-label={contentDisplay.rawField.ariaLabelText}
      placeholderText={contentDisplay.rawField.placeholder}
      value={contentDisplay.rawField.value}
      hidden={!contentDisplay.showRawPanel}
      onValueInput={recordRawInputChangeHandler()}
    />
  </div>
</div>

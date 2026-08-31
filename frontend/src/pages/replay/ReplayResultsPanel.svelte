<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import type {
    ReplayControlsDisplay,
    ReplayResultsDisplay,
  } from "$domains/replay/index.js";
  import DetailFieldCard from "../../components/fragments/DetailFieldCard.svelte";
  import EventEntriesTable from "../../components/fragments/EventEntriesTable.svelte";
  import OutputBlock from "../../components/fragments/OutputBlock.svelte";
  import PlainCheckboxField from "../../components/fragments/PlainCheckboxField.svelte";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import SummaryMetricCard from "../../components/fragments/SummaryMetricCard.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import TabList from "../../components/fragments/TabList.svelte";
  import ValueLabelSelectField from "../../components/fragments/ValueLabelSelectField.svelte";

  let {
    controlsDisplay,
    onEventKindChange,
    onFailedOnlyChange,
    onModeSelect,
    onOpenEntryIndex,
    onResetFilters,
    onSearchInput,
    resultsDisplay,
  }: {
    controlsDisplay: ReplayControlsDisplay;
    onEventKindChange?: (value: string) => unknown;
    onFailedOnlyChange?: (checked: boolean) => unknown;
    onModeSelect?: (value: string) => unknown;
    onOpenEntryIndex?: (index: number) => unknown;
    onResetFilters?: (event: MouseEvent) => unknown;
    onSearchInput?: (value: string) => void;
    resultsDisplay: ReplayResultsDisplay;
  } = $props();
</script>

<div class="grid gap-4">
  <div
    class="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-border bg-muted/30 px-4 py-3"
  >
    <div class="inline-flex items-center gap-2 whitespace-nowrap">
      <span class="text-sm font-medium text-muted-foreground">
        {controlsDisplay.displayModeLabel}
      </span>
      <TabList
        tabItems={controlsDisplay.replayModeTabs}
        activeValue={controlsDisplay.displayMode}
        aria-label={controlsDisplay.displayModeLabel}
        onSelect={onModeSelect}
      />
    </div>
    <div class="inline-flex whitespace-nowrap">
      <PlainCheckboxField
        checked={controlsDisplay.failedOnly}
        labelText={controlsDisplay.failedOnlyLabel}
        title={controlsDisplay.failedOnlyLabel}
        onCheckedChange={onFailedOnlyChange}
      />
    </div>
    <div class="ml-auto inline-flex flex-wrap items-center gap-2">
      <ValueLabelSelectField
        value={controlsDisplay.eventKind}
        class="w-48"
        title={controlsDisplay.eventKindLabel}
        aria-label={controlsDisplay.eventKindLabel}
        optionRows={controlsDisplay.eventKindOptionRows}
        onValueChange={onEventKindChange}
      />
      <PlainInputField
        value={controlsDisplay.searchField.value}
        class="w-52"
        aria-label={controlsDisplay.searchField.ariaLabelText}
        placeholderText={controlsDisplay.searchField.placeholder}
        onValueInput={onSearchInput}
      />
      <Button
        variant="ghost"
        size="sm"
        type="button"
        class="text-muted-foreground"
        onclick={onResetFilters}
      >
        {controlsDisplay.clearFiltersLabel}
      </Button>
    </div>
  </div>

  <div class="grid gap-4" hidden={!resultsDisplay.showListMode}>
    {#if resultsDisplay.statusText}
      <StatusCard message={resultsDisplay.statusText} />
    {:else if !resultsDisplay.hasReplayResult}
      <div
        class="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-background py-14 text-center"
      >
        <p class="text-sm text-muted-foreground">
          {resultsDisplay.emptyResultText}
        </p>
      </div>
    {:else}
      {#if resultsDisplay.hasReplayContext}
        <section class="rounded-2xl border border-border bg-muted/30 p-4">
          <div class="mb-2 text-xs font-semibold text-muted-foreground">
            {resultsDisplay.contextTitle}
          </div>
          <div class="grid gap-2 md:grid-cols-3">
            {#each resultsDisplay.replayContextRows as replayContextRow (replayContextRow.key)}
              <DetailFieldCard
                label={replayContextRow.labelText}
                detailValue={replayContextRow.detailValue}
                mono
              />
            {/each}
          </div>
        </section>
      {/if}
      {#if resultsDisplay.hasReplayEntries}
        <div class="grid gap-2 md:grid-cols-4">
          {#each resultsDisplay.replayStatCards as replayStatCard}
            <SummaryMetricCard
              label={replayStatCard.label}
              metricValue={replayStatCard.statValue}
              size="lg"
            />
          {/each}
        </div>
        <EventEntriesTable
          entryRows={resultsDisplay.replayEntryRows}
          {onOpenEntryIndex}
          tableHeaderCells={resultsDisplay.replayTableHeaderCells}
        />
      {/if}
      {#if resultsDisplay.hasReplayOutput}
        <section class="grid gap-2">
          <div class="inline-flex items-center gap-2 text-xs">
            <span class={resultsDisplay.outputStatusClass}>
              {resultsDisplay.outputStatusLabel}
            </span>
            <span class="font-mono text-muted-foreground">
              {resultsDisplay.outputPromptText}
            </span>
          </div>
          <OutputBlock title={resultsDisplay.outputTitle}>
            {resultsDisplay.outputContent}
          </OutputBlock>
        </section>
      {/if}
      {#if !resultsDisplay.hasReplayEntries && !resultsDisplay.hasReplayOutput}
        <StatusCard message={resultsDisplay.emptyReplayText} />
      {/if}
    {/if}
  </div>

  <OutputBlock hidden={!resultsDisplay.showRawMode}>
    {resultsDisplay.rawResultText}
  </OutputBlock>
</div>

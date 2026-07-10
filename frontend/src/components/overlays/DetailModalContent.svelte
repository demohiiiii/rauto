<script>
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import DetailFieldCard from "../fragments/DetailFieldCard.svelte";
  import StatusCard from "../fragments/StatusCard.svelte";
  import OutputBlock from "../fragments/OutputBlock.svelte";
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import CheckCircle2Icon from "@lucide/svelte/icons/check-circle-2";
  import CircleDotIcon from "@lucide/svelte/icons/circle-dot";
  import ClockIcon from "@lucide/svelte/icons/clock";
  import CpuIcon from "@lucide/svelte/icons/cpu";
  import LayersIcon from "@lucide/svelte/icons/layers";
  import ListChecksIcon from "@lucide/svelte/icons/list-checks";
  import ServerIcon from "@lucide/svelte/icons/server";
  import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
  import TerminalIcon from "@lucide/svelte/icons/terminal";
  import VideoIcon from "@lucide/svelte/icons/video";
  import XCircleIcon from "@lucide/svelte/icons/x-circle";
  import { cn } from "$lib/utils.js";

  let { contentDisplay } = $props();
  let OrchestrationDetailComponent = $derived(
    contentDisplay.OrchestrationDetailComponent,
  );
  const metaIconRows = [
    ClockIcon,
    CircleDotIcon,
    TerminalIcon,
    ShieldCheckIcon,
    CpuIcon,
    ServerIcon,
    VideoIcon,
  ];
  const statIconRows = [LayersIcon, TerminalIcon, XCircleIcon, ListChecksIcon];
  const statToneRows = [
    "bg-primary/10 text-primary",
    "bg-chart-3/10 text-chart-3",
    "bg-destructive/10 text-destructive",
    "bg-chart-4/15 text-chart-4",
  ];

  function metaIcon(metaIndex) {
    return metaIconRows[metaIndex] || CircleDotIcon;
  }

  function statIcon(statIndex) {
    return statIconRows[statIndex] || ListChecksIcon;
  }

  function statTone(statIndex) {
    return statToneRows[statIndex] || "bg-secondary text-secondary-foreground";
  }

  function openHistoryEvent(entryIndex) {
    if (typeof contentDisplay.onOpenHistoryEntryIndex === "function") {
      return contentDisplay.onOpenHistoryEntryIndex(entryIndex);
    }
    return undefined;
  }
</script>

{#snippet historyMetaCard()}
  <section class="rounded-2xl border border-border bg-background p-5">
    <h3 class="mb-4 text-sm font-semibold text-foreground">
      {contentDisplay.historyDetailDisplay.metaTitle}
    </h3>
    <div class="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
      {#each contentDisplay.historyDetailDisplay.metaFields as historyMetaField, metaIndex}
        {@const MetaIcon = metaIcon(metaIndex)}
        <div class="flex min-w-0 items-start gap-2.5">
          <span
            class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground"
          >
            <MetaIcon class="size-3.5" />
          </span>
          <div class="flex min-w-0 flex-col">
            <span class="text-xs text-muted-foreground">
              {historyMetaField.label}
            </span>
            <span
              class={cn(
                "truncate text-sm font-medium text-foreground",
                historyMetaField.mono && "font-mono",
              )}
            >
              {historyMetaField.detailValue}
            </span>
          </div>
        </div>
      {/each}
    </div>
  </section>
{/snippet}

{#snippet historyStatsGrid()}
  <section class="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-4">
    {#each contentDisplay.historyDetailDisplay.statCards as historyStatCard, statIndex}
      {@const StatIcon = statIcon(statIndex)}
      <div
        class="flex items-center gap-3 rounded-2xl border border-border bg-background p-4"
      >
        <span
          class={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            statTone(statIndex),
          )}
        >
          <StatIcon class="size-5" />
        </span>
        <div class="flex min-w-0 flex-1 flex-col text-right sm:text-left">
          <span class="text-xs text-muted-foreground">
            {historyStatCard.labelText}
          </span>
          <span
            class="text-2xl font-semibold leading-tight text-foreground tabular-nums"
          >
            {historyStatCard.statValue}
          </span>
        </div>
      </div>
    {/each}
  </section>
{/snippet}

{#snippet historyEventCard(historyEventRow)}
  <li class="rounded-2xl border border-border bg-background p-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
        <span
          class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-semibold text-secondary-foreground"
        >
          {historyEventRow.indexText}
        </span>
        <Badge
          variant="outline"
          class="bg-chart-3/10 font-mono text-chart-3 ring-1 ring-chart-3/20 ring-inset"
        >
          {historyEventRow.kindText}
        </Badge>
        <Badge
          variant="outline"
          class="bg-chart-4/15 text-chart-4 ring-1 ring-chart-4/25 ring-inset"
        >
          {historyEventRow.modeText}
        </Badge>
      </div>
      {#if historyEventRow.showSuccessBadge}
        <Badge
          variant="outline"
          class={cn(
            "gap-1 rounded-full",
            historyEventRow.success
              ? "bg-primary/10 text-primary ring-primary/20"
              : "bg-destructive/10 text-destructive ring-destructive/20",
          )}
        >
          {#if historyEventRow.success}
            <CheckCircle2Icon class="size-3.5" />
          {:else}
            <XCircleIcon class="size-3.5" />
          {/if}
          {historyEventRow.successLabelText}
        </Badge>
      {/if}
    </div>

    <div
      class="mt-3 flex min-w-0 items-center gap-2 rounded-lg bg-foreground/[0.04] px-3 py-2 dark:bg-foreground/[0.06]"
    >
      <TerminalIcon class="size-3.5 shrink-0 text-muted-foreground" />
      <code class="truncate font-mono text-sm text-foreground">
        {historyEventRow.commandText}
      </code>
    </div>

    <div class="mt-3">
      <span class="text-xs text-muted-foreground">Prompt</span>
      <div
        class="mt-1.5 grid items-center gap-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
      >
        <div
          class="flex-1 rounded-lg border border-chart-3/20 bg-chart-3/5 px-3 py-2"
        >
          <div class="text-[11px] font-medium text-chart-3">Before</div>
          <code class="break-all font-mono text-sm text-foreground">
            {historyEventRow.promptBefore}
          </code>
        </div>
        <ArrowRightIcon
          class="mx-auto size-4 shrink-0 rotate-90 text-muted-foreground lg:rotate-0"
        />
        <div
          class="flex-1 rounded-lg border border-chart-4/25 bg-chart-4/10 px-3 py-2"
        >
          <div class="text-[11px] font-medium text-chart-4">After</div>
          <code class="break-all font-mono text-sm text-foreground">
            {historyEventRow.promptAfter}
          </code>
        </div>
      </div>
    </div>

    <div class="mt-4 flex justify-end border-t border-border pt-3">
      <Button
        variant="outline"
        size="sm"
        type="button"
        onclick={() => openHistoryEvent(historyEventRow.entryIndex)}
      >
        {historyEventRow.detailButtonLabel}
      </Button>
    </div>
  </li>
{/snippet}

{#if contentDisplay.detailModalContentDisplay.showHistoryDetail}
  <div class="flex flex-col gap-5">
    {@render historyMetaCard()}

    {#if contentDisplay.historyDetailDisplay.hasEntries}
      {@render historyStatsGrid()}
      <section class="flex flex-col gap-3">
        <div class="flex items-center justify-between px-1">
          <span class="text-sm font-semibold text-foreground">
            {contentDisplay.historyDetailDisplay.eventsTitle}
          </span>
          <Badge variant="secondary">
            {contentDisplay.historyDetailDisplay.entryCountText}
          </Badge>
        </div>
        <ul class="flex flex-col gap-3">
          {#each contentDisplay.historyDetailDisplay.entryRows as historyEventRow}
            {@render historyEventCard(historyEventRow)}
          {/each}
        </ul>
      </section>
    {:else}
      <StatusCard message={contentDisplay.historyDetailDisplay.emptyMessage} />
    {/if}
  </div>
{:else if contentDisplay.detailModalContentDisplay.showOrchestrationDetail}
  {#if OrchestrationDetailComponent}
    <OrchestrationDetailComponent
      {...contentDisplay.orchestrationDetailDisplay}
    />
  {:else if contentDisplay.detailModalContentDisplay.detailRendererLoadError}
    <StatusCard
      message={contentDisplay.detailModalContentDisplay.detailRendererLoadError}
      tone="error"
      variant="alert"
    />
  {:else}
    <StatusCard
      message={contentDisplay.detailModalContentDisplay.loadingMessage}
      variant="alert"
    />
  {/if}
{:else if contentDisplay.detailModalContentDisplay.showConnectionImportDetail}
  <div class="grid gap-3">
    <section class="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div class="grid gap-2 sm:grid-cols-2">
        {#each contentDisplay.connectionImportDetailDisplay.summaryRows as summaryRow}
          <DetailFieldCard
            label={summaryRow.label}
            detailValue={summaryRow.summaryValue}
          />
        {/each}
      </div>
    </section>

    <section>
      <div class="mb-2 text-xs font-semibold text-slate-500">
        {contentDisplay.connectionImportDetailDisplay.failuresTitle}
      </div>
      {#if contentDisplay.connectionImportDetailDisplay.hasFailures}
        <ul class="grid gap-2">
          {#each contentDisplay.connectionImportDetailDisplay.failureRows as failureRow}
            <li
              class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
              <span class="font-semibold">
                {contentDisplay.connectionImportDetailDisplay.failureRowLabel}
                {failureRow.sourceRowText}
              </span>
              {#if failureRow.hasName}
                [{failureRow.name}]
              {/if}
              : {failureRow.message}
            </li>
          {/each}
        </ul>
      {:else}
        <StatusCard
          message={contentDisplay.connectionImportDetailDisplay
            .emptyFailureMessage}
        />
      {/if}
    </section>
  </div>
{:else if contentDisplay.detailModalContentDisplay.showTextDetail}
  <OutputBlock class="max-h-[70vh]" contentClass="whitespace-pre-wrap break-all"
    >{contentDisplay.textDetailDisplay.detailText}</OutputBlock
  >
{/if}

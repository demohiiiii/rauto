<script lang="ts">
  import { onMount, untrack } from "svelte";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import ChevronUpIcon from "@lucide/svelte/icons/chevron-up";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import ClockIcon from "@lucide/svelte/icons/clock-3";
  import FilterIcon from "@lucide/svelte/icons/list-filter";
  import * as Sheet from "$lib/components/ui/sheet/index.js";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { currentLanguageState, t } from "$lib/i18n.js";
  import {
    executionHistory,
    executionHistoryFunctions,
    filterExecutionHistory,
    type ExecutionHistoryFunction,
  } from "$domains/execution/index.js";
  import ExecutionHistoryDetail from "$domains/execution/presentation/components/ExecutionHistoryDetail.svelte";
  import ExecutionHistoryStatus from "$domains/execution/presentation/components/ExecutionHistoryStatus.svelte";

  let {
    active,
    feature,
  }: { active: boolean; feature: ExecutionHistoryFunction } = $props();
  const { state: historyState } = executionHistory;
  const limitId = $props.id();
  let sheetOpen = $state(false);
  let selectedId = $state("");
  let selectedFunctions = $state<ExecutionHistoryFunction[]>([]);
  let now = $state(Date.now());
  let observed = "";
  let initialized = false;
  let entries = $derived(
    filterExecutionHistory($historyState.entries, selectedFunctions),
  );
  let selected = $derived(
    entries.find((entry) => entry.id === selectedId) ?? entries[0],
  );
  let latest = $derived($historyState.entries[0]);
  let currentLatest = $derived(
    $historyState.entries.find((entry) => entry.feature === feature),
  );
  let allSelected = $derived(
    selectedFunctions.length === executionHistoryFunctions.length,
  );
  let functionLabels = $derived.by(() => {
    $currentLanguageState;
    return {
      show: t("opExecShow"),
      "config-fetch": t("configFetchTitle"),
      command: t("commandDeliveryTitle"),
      interactive: t("interactiveDeliveryTitle"),
    };
  });

  $effect(() => {
    feature;
    if (active) {
      selectedFunctions = [feature];
      selectedId = "";
    } else sheetOpen = false;
  });
  $effect(() => {
    const latest = currentLatest;
    const statusKey = latest ? latest.id + ":" + latest.status : "";
    if (initialized && observed !== statusKey && latest && active) {
      if (untrack(() => selectedFunctions.includes(latest.feature)))
        selectedId = latest.id;
      if (latest.status !== "running") sheetOpen = true;
    }
    observed = statusKey;
    initialized = true;
  });
  onMount(() => {
    const timer = window.setInterval(() => (now = Date.now()), 30000);
    return () => window.clearInterval(timer);
  });
  function relativeTime(value: string) {
    const seconds = Math.max(0, Math.floor((now - Date.parse(value)) / 1000));
    if (seconds < 60) return t("executionHistoryJustNow");
    const minutes = Math.floor(seconds / 60);
    return new Intl.RelativeTimeFormat($currentLanguageState, {
      numeric: "auto",
    }).format(
      minutes < 60
        ? -minutes
        : minutes < 1440
          ? -Math.floor(minutes / 60)
          : -Math.floor(minutes / 1440),
      minutes < 60 ? "minute" : minutes < 1440 ? "hour" : "day",
    );
  }
  function exactTime(value: string) {
    return new Date(value).toLocaleString($currentLanguageState);
  }
  function toggleFeature(value: ExecutionHistoryFunction, checked: boolean) {
    selectedFunctions = checked
      ? [...selectedFunctions, value]
      : selectedFunctions.filter((item) => item !== value);
  }
</script>

<Sheet.Root bind:open={sheetOpen}>
  <button
    type="button"
    data-execution-history-trigger
    class="flex h-16 min-w-0 w-full items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-card/95 px-4 text-left shadow-lg backdrop-blur-xl transition hover:border-primary/40 hover:bg-card"
    aria-label={t("showHistoryExpand")}
    aria-expanded={sheetOpen}
    onclick={() => (sheetOpen = true)}
  >
    <span class="flex min-w-0 items-center gap-3">
      <span
        class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
        ><HistoryIcon class="size-4" aria-hidden="true" /></span
      >
      <span class="min-w-0">
        <span class="block truncate text-sm font-semibold"
          >{t("executionHistoryTitle")}</span
        >
        <span class="flex items-center gap-1 text-xs text-muted-foreground">
          <ClockIcon class="size-3 shrink-0" aria-hidden="true" />
          {#if latest}<time
              class="truncate"
              datetime={latest.startedAt}
              title={exactTime(latest.startedAt)}
              >{relativeTime(latest.startedAt)}</time
            >
          {:else}{t("executionHistoryNoRuns")}{/if}
        </span>
      </span>
    </span>
    <span class="flex shrink-0 items-center gap-2"
      >{#if latest}<ExecutionHistoryStatus
          status={latest.status}
        />{/if}<ChevronUpIcon
        class="size-4 text-muted-foreground"
        aria-hidden="true"
      /></span
    >
  </button>
  {#if active}
    <Sheet.Content
      side="bottom"
      showCloseButton={false}
      aria-describedby={undefined}
      class="h-[88dvh] max-h-[88dvh] min-h-0 gap-0 overflow-hidden rounded-t-3xl border-primary/20 p-0"
    >
      <div
        class="mx-auto my-3 h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/25"
        aria-hidden="true"
      ></div>
      <Sheet.Header
        class="flex flex-row flex-wrap items-start justify-between gap-3 border-b px-4 pb-3 sm:px-5"
      >
        <div class="text-left">
          <Sheet.Title class="flex items-center gap-2"
            ><HistoryIcon class="size-4 text-primary" aria-hidden="true" />{t(
              "executionHistoryTitle",
            )}</Sheet.Title
          >
          <div class="mt-3 flex items-center gap-2">
            <label for={limitId} class="text-xs text-muted-foreground"
              >{t("executionHistoryRetention")}</label
            >
            <Input
              id={limitId}
              class="h-9 w-20"
              type="number"
              min="1"
              max="100"
              step="1"
              value={$historyState.limit}
              onchange={(event) =>
                executionHistory.setLimit(
                  Number(event.currentTarget.value) || 10,
                )}
            />
            <span class="text-xs text-muted-foreground"
              >{t("executionHistoryRecordUnit")}</span
            >
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onclick={() => (sheetOpen = false)}
            ><ChevronDownIcon class="size-4" aria-hidden="true" />{t(
              "showHistoryCollapse",
            )}</Button
          >
        </div>
      </Sheet.Header>
      <div
        class="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden lg:grid-cols-[17rem_minmax(0,1fr)] lg:grid-rows-1"
      >
        <div
          class="flex min-h-0 flex-col border-b bg-muted/20 lg:border-r lg:border-b-0"
        >
          <div class="shrink-0 border-b p-3">
            <Popover.Root>
              <Popover.Trigger
                class="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm"
                aria-label={t("executionHistoryFilter")}
              >
                <FilterIcon class="size-4" aria-hidden="true" />{allSelected
                  ? t("executionHistoryAll")
                  : t("executionHistoryFilter")}
              </Popover.Trigger>
              <Popover.Content class="z-[60] w-72 space-y-3" align="start">
                <label
                  class="flex cursor-pointer items-center gap-2 text-sm font-medium"
                >
                  <Checkbox
                    checked={allSelected}
                    indeterminate={selectedFunctions.length > 0 && !allSelected}
                    onCheckedChange={(checked) =>
                      (selectedFunctions = checked
                        ? [...executionHistoryFunctions]
                        : [])}
                  />
                  {t("executionHistoryAll")}
                </label>
                {#each executionHistoryFunctions as key}
                  <label class="flex cursor-pointer items-center gap-2 text-sm"
                    ><Checkbox
                      checked={selectedFunctions.includes(key)}
                      onCheckedChange={(checked) => toggleFeature(key, checked)}
                    />{functionLabels[key]}</label
                  >
                {/each}
              </Popover.Content>
            </Popover.Root>
          </div>
          <nav
            class="max-h-44 min-h-0 flex-1 space-y-2 overflow-y-auto p-3 lg:max-h-none"
            aria-label={t("executionHistoryTitle")}
          >
            {#each entries as entry (entry.id)}
              <button
                type="button"
                class={entry.id === selected?.id
                  ? "flex w-full items-center gap-3 rounded-xl border border-primary/50 bg-card p-3 text-left"
                  : "flex w-full items-center gap-3 rounded-xl border p-3 text-left hover:bg-card/80"}
                aria-pressed={entry.id === selected?.id}
                onclick={() => (selectedId = entry.id)}
              >
                <ExecutionHistoryStatus status={entry.status} />
                <span class="min-w-0">
                  <time
                    class="block truncate text-sm font-medium"
                    datetime={entry.startedAt}
                    title={exactTime(entry.startedAt)}
                    >{relativeTime(entry.startedAt)}</time
                  >
                  <span class="block truncate text-xs text-muted-foreground"
                    >{functionLabels[entry.feature]} · {t(
                      entry.scope === "batch"
                        ? "executionHistoryBatch"
                        : "executionHistorySingle",
                    )}</span
                  >
                  <time
                    class="block text-xs tabular-nums text-muted-foreground"
                    datetime={entry.startedAt}
                    >{exactTime(entry.startedAt)}</time
                  >
                </span>
              </button>
            {/each}
          </nav>
        </div>
        <div class="min-h-0 min-w-0 overflow-y-auto p-3 sm:p-5">
          {#if selected}{#key selected.id}<ExecutionHistoryDetail
                entry={selected}
              />{/key}
          {:else}<p class="p-6 text-center text-sm text-muted-foreground">
              {t("executionHistoryEmpty")}
            </p>{/if}
        </div>
      </div>
    </Sheet.Content>
  {/if}
</Sheet.Root>

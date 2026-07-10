<script>
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import SearchIcon from "@lucide/svelte/icons/search";
  import ServerIcon from "@lucide/svelte/icons/server";
  import TerminalIcon from "@lucide/svelte/icons/terminal";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { cn } from "$lib/utils.js";
  import PlainSelectField from "../fragments/PlainSelectField.svelte";
  import { plainInputFieldBindings } from "../../lib/events.js";
  import { createHistoryDrawerContentWorkspace } from "../../modules/connections.js";

  let {
    historyDisplay,
    onDeleteItem,
    onLimitChange,
    onOpenItem,
    onOperationChange,
    onQueryInput,
    onClearFilters,
    onRefresh,
  } = $props();

  function handleDeleteItem(historyId) {
    if (typeof onDeleteItem === "function") {
      return onDeleteItem(historyId);
    }
    return undefined;
  }

  function handleLimitChange(limitValue) {
    if (typeof onLimitChange === "function") {
      return onLimitChange(limitValue);
    }
    return undefined;
  }

  function handleOpenItem(historyId) {
    if (typeof onOpenItem === "function") {
      return onOpenItem(historyId);
    }
    return undefined;
  }

  function handleOperationChange(operationValue) {
    if (typeof onOperationChange === "function") {
      return onOperationChange(operationValue);
    }
    return undefined;
  }

  function handleQueryInput(queryValue) {
    if (typeof onQueryInput === "function") {
      return onQueryInput(queryValue);
    }
    return undefined;
  }

  function operationBadgeClass(operationLabel = "") {
    const normalizedOperation = String(operationLabel).toLowerCase();
    if (
      normalizedOperation.includes("template") ||
      normalizedOperation.includes("模板")
    ) {
      return "bg-secondary text-secondary-foreground ring-secondary/30";
    }
    if (
      normalizedOperation.includes("config") ||
      normalizedOperation.includes("配置")
    ) {
      return "bg-accent text-accent-foreground ring-accent/30";
    }
    return "bg-primary/10 text-primary ring-primary/20";
  }

  function recordLevelBadgeClass(recordLevelText = "") {
    const normalizedLevel = String(recordLevelText).toLowerCase();
    return normalizedLevel === "full"
      ? "bg-accent text-accent-foreground"
      : "bg-primary/10 text-primary";
  }

  function optionValue(optionRow = {}) {
    return String(optionRow.value ?? "");
  }

  function optionLabel(optionRow = {}) {
    return String(optionRow.label ?? optionRow.value ?? "");
  }

  function selectOptionRows(optionRows = []) {
    return optionRows.map((optionRow) => ({
      optionValue: optionValue(optionRow),
      optionLabel: optionLabel(optionRow),
    }));
  }

  let filtersDisplay = $derived(historyDisplay.filtersDisplay);
  const historyDrawerContentWorkspace = createHistoryDrawerContentWorkspace({
    onDeleteItem: handleDeleteItem,
    onLimitChange: handleLimitChange,
    onOpenItem: handleOpenItem,
    onOperationChange: handleOperationChange,
    onQueryInput: handleQueryInput,
  });
  const {
    deleteHistoryItemAction,
    historyLimitChangeHandler,
    historyOperationChangeHandler,
    historyQueryInputHandler,
    openHistoryItemAction,
  } = historyDrawerContentWorkspace;
  let historyRows = $derived(historyDisplay.filteredRows || []);
  let queryInputBindings = $derived(
    plainInputFieldBindings({
      onValueInput: historyQueryInputHandler(),
    }),
  );
</script>

{#snippet selectControl({
  value,
  label,
  optionRows,
  onChange,
  className = "sm:w-40",
})}
  <div class={cn("min-w-0", className)}>
    <PlainSelectField
      {value}
      aria-label={label}
      title={label}
      onchange={onChange}
      optionRows={selectOptionRows(optionRows)}
      class="h-10 w-full justify-between rounded-lg bg-card"
    />
  </div>
{/snippet}

{#snippet historyCard(historyRow)}
  <li
    class="group rounded-2xl border border-border bg-background p-4 shadow-xs transition-all hover:border-primary/40 hover:shadow-sm"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="flex min-w-0 flex-wrap items-center gap-2.5">
        <span
          class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-semibold text-secondary-foreground"
        >
          {historyRow.indexText}
        </span>
        <Badge
          variant="outline"
          class={cn(
            "ring-1 ring-inset",
            operationBadgeClass(historyRow.operationLabel),
          )}
        >
          {historyRow.operationLabel}
        </Badge>
      </div>
      <time class="shrink-0 font-mono text-xs text-muted-foreground">
        {historyRow.timestampText}
      </time>
    </div>

    <div
      class="mt-3 flex min-w-0 items-center gap-2 rounded-lg bg-secondary/60 px-3 py-2"
    >
      <TerminalIcon class="size-3.5 shrink-0 text-muted-foreground" />
      <code class="truncate font-mono text-sm text-foreground">
        {historyRow.commandLabel}
      </code>
    </div>

    <div
      class="mt-3 grid min-w-0 gap-x-4 gap-y-2 text-xs sm:grid-cols-[auto_auto_minmax(0,1fr)] sm:items-center"
    >
      <div class="flex items-center gap-1.5">
        <span class="text-muted-foreground">
          {historyDisplay.modeLabel}
        </span>
        <Badge variant="secondary" class="h-5 font-medium">
          {historyRow.modeText}
        </Badge>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="text-muted-foreground">
          {historyDisplay.recordLevelLabel}
        </span>
        <Badge
          variant="outline"
          class={cn(
            "h-5 font-medium",
            recordLevelBadgeClass(historyRow.recordLevelText),
          )}
        >
          {historyRow.recordLevelText}
        </Badge>
      </div>
      <div
        class="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1.5"
      >
        <ServerIcon class="size-3.5 shrink-0 text-muted-foreground" />
        <span class="truncate font-mono text-foreground">
          {historyRow.connectionName}
        </span>
        <span class="truncate font-mono text-muted-foreground">
          {historyRow.hostPort}
        </span>
        <span class="truncate font-mono text-muted-foreground">
          · {historyRow.deviceProfile}
        </span>
      </div>
    </div>

    <div
      class="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-3"
    >
      <Button
        variant="outline"
        size="sm"
        type="button"
        onclick={openHistoryItemAction(historyRow.historyId)}
      >
        <EyeIcon data-icon="inline-start" />
        {historyRow.detailButtonLabel}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        class="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onclick={deleteHistoryItemAction(historyRow.historyId)}
      >
        <Trash2Icon data-icon="inline-start" />
        {historyRow.deleteButtonLabel}
      </Button>
    </div>
  </li>
{/snippet}

<div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-6">
  <section class="rounded-2xl border border-border bg-background p-5">
    <div class="flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-2.5">
        <span
          class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"
        >
          <ServerIcon class="size-4" />
        </span>
        <div class="flex min-w-0 flex-col">
          <span class="text-sm font-medium text-foreground">
            {historyDisplay.connectionTitle}
          </span>
          <span class="truncate font-mono text-xs text-muted-foreground">
            {historyDisplay.connectionLabel}
          </span>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        type="button"
        disabled={historyDisplay.refreshLoading}
        onclick={onRefresh}
      >
        {#if historyDisplay.refreshLoading}
          <Spinner data-icon="inline-start" />
        {:else}
          <RefreshCwIcon data-icon="inline-start" />
        {/if}
        {historyDisplay.refreshButtonLabel}
      </Button>
    </div>
  </section>

  <section
    class="grid gap-3 rounded-2xl border border-border bg-background p-4 sm:grid-cols-[minmax(0,1fr)_10rem_8rem_auto] sm:items-center"
  >
    <div class="relative min-w-0 flex-1">
      <SearchIcon
        class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        value={historyDisplay.query}
        aria-label={filtersDisplay.queryPlaceholder}
        placeholder={filtersDisplay.queryPlaceholder}
        class="h-10 rounded-lg bg-card pl-9"
        oninput={queryInputBindings.inputHandler}
      />
    </div>
    {@render selectControl({
      value: historyDisplay.operation,
      label: filtersDisplay.operationLabel,
      optionRows: filtersDisplay.operationOptionRows,
      onChange: historyOperationChangeHandler(),
    })}
    {@render selectControl({
      value: historyDisplay.limit,
      label: filtersDisplay.limitLabel,
      optionRows: filtersDisplay.limitOptionRows,
      onChange: historyLimitChangeHandler(),
      className: "sm:w-32",
    })}
    <Button
      variant="ghost"
      size="sm"
      type="button"
      class="text-muted-foreground"
      onclick={onClearFilters}
    >
      <Trash2Icon data-icon="inline-start" />
      {filtersDisplay.clearButtonLabel}
    </Button>
  </section>

  <section class="flex flex-col gap-3">
    <div class="flex items-center justify-between px-1">
      <span class="text-sm font-medium text-foreground">
        {historyDisplay.listTitle}
      </span>
      <Badge variant="secondary">
        {historyDisplay.rowCountText}
      </Badge>
    </div>

    {#if historyDisplay.hasRows}
      <ul class="flex flex-col gap-3">
        {#each historyRows as historyRow (historyRow.historyId)}
          {@render historyCard(historyRow)}
        {/each}
      </ul>
    {:else}
      <div
        class="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-background py-16 text-center"
      >
        <TerminalIcon class="size-6 text-muted-foreground" />
        <p class="text-sm text-muted-foreground">
          {historyDisplay.emptyStatus.message}
        </p>
      </div>
    {/if}
  </section>
</div>

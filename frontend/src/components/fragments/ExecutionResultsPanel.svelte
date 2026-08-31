<script lang="ts">
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import CircleCheckIcon from "@lucide/svelte/icons/circle-check";
  import CircleXIcon from "@lucide/svelte/icons/circle-x";
  import StatusCard from "./StatusCard.svelte";
  import WorkspaceActionHeader from "./WorkspaceActionHeader.svelte";
  import type { Component, Snippet } from "svelte";

  type ResultStatusTone = "error" | "info" | "success" | "warning";
  type StatusTone = ResultStatusTone | "running";

  interface ExecutionResultItem {
    key: string;
    statusLabel?: string;
    statusTone?: ResultStatusTone;
    subtitle?: string;
    title: string;
  }

  interface ExecutionResultsPanelProps {
    actions?: Snippet;
    activeKey?: string;
    description?: string;
    detail?: Snippet;
    emptyMessage?: string;
    failedCount?: number | null;
    failedLabel?: string;
    icon?: Component<any> | null;
    items?: ExecutionResultItem[];
    navigationAriaLabel?: string;
    onSelect?: (key: string) => unknown;
    statusMessage?: string;
    statusTone?: StatusTone;
    succeededCount?: number | null;
    succeededLabel?: string;
    title?: string;
    totalCount?: number | null;
    totalLabel?: string;
  }

  let {
    actions: customActions,
    activeKey = "",
    description = "",
    detail,
    emptyMessage = "",
    failedCount = null,
    failedLabel = "",
    icon = null,
    items = [],
    navigationAriaLabel = "",
    onSelect,
    statusMessage = "",
    statusTone = "info",
    succeededCount = null,
    succeededLabel = "",
    title = "",
    totalCount = null,
    totalLabel = "",
  }: ExecutionResultsPanelProps = $props();

  let showSummary = $derived(
    totalCount !== null || succeededCount !== null || failedCount !== null,
  );
  function itemBadgeVariant(item: ExecutionResultItem) {
    if (item.statusTone === "error") return "destructive";
    if (item.statusTone === "success") return "outline";
    return "secondary";
  }

  function itemButtonVariant(item: ExecutionResultItem) {
    if (item.key === activeKey && item.statusTone === "error") {
      return "destructive";
    }
    return item.key === activeKey ? "secondary" : "ghost";
  }

  function itemButtonClass(item: ExecutionResultItem) {
    const base = "h-auto min-w-48 justify-start px-3 py-3 lg:min-w-0";
    return item.statusTone === "error"
      ? `${base} text-destructive hover:bg-destructive/10 hover:text-destructive`
      : base;
  }
</script>

{#snippet headerActions()}
  <div class="flex min-w-0 flex-wrap items-center gap-2">
    {#if totalCount !== null}
      <Badge variant="outline">{totalLabel} {totalCount}</Badge>
    {/if}
    {#if succeededCount !== null}
      <Badge variant="secondary">
        {succeededLabel}
        {succeededCount}
      </Badge>
    {/if}
    {#if failedCount !== null && failedCount > 0}
      <Badge variant="destructive">{failedLabel} {failedCount}</Badge>
    {/if}
    {#if customActions}
      {@render customActions()}
    {/if}
  </div>
{/snippet}

<Card.Root class="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
  <WorkspaceActionHeader
    {title}
    {description}
    {icon}
    actions={showSummary || customActions ? headerActions : undefined}
  />

  <Card.Content class="p-0">
    {#if statusMessage}
      <div class="border-b border-border p-4 sm:p-5" aria-live="polite">
        <StatusCard message={statusMessage} tone={statusTone} variant="alert" />
      </div>
    {/if}

    {#if items.length}
      <div
        class={items.length > 1
          ? "grid min-w-0 lg:grid-cols-[minmax(13rem,18rem)_minmax(0,1fr)]"
          : "min-w-0"}
      >
        {#if items.length > 1}
          <nav
            class="flex gap-2 overflow-x-auto border-b border-border p-3 lg:flex-col lg:overflow-x-visible lg:border-r lg:border-b-0"
            aria-label={navigationAriaLabel}
          >
            {#each items as item (item.key)}
              <Button
                variant={itemButtonVariant(item)}
                class={itemButtonClass(item)}
                aria-pressed={item.key === activeKey}
                onclick={() => onSelect?.(item.key)}
              >
                <span class="grid min-w-0 flex-1 gap-1 text-left">
                  <span class="truncate font-mono font-semibold">
                    {item.title}
                  </span>
                  {#if item.subtitle}
                    <span class="truncate text-xs text-muted-foreground">
                      {item.subtitle}
                    </span>
                  {/if}
                </span>
                {#if item.statusLabel}
                  <Badge variant={itemBadgeVariant(item)}>
                    {#if item.statusTone === "error"}
                      <CircleXIcon aria-hidden="true" />
                    {:else if item.statusTone === "success"}
                      <CircleCheckIcon aria-hidden="true" />
                    {/if}
                    {item.statusLabel}
                  </Badge>
                {/if}
              </Button>
            {/each}
          </nav>
        {/if}

        <section class="flex min-w-0 flex-col gap-4 p-4 sm:p-5">
          {@render detail?.()}
        </section>
      </div>
    {:else if !statusMessage && emptyMessage}
      <div class="p-4 sm:p-5">
        <StatusCard message={emptyMessage} tone="info" />
      </div>
    {/if}
  </Card.Content>
</Card.Root>

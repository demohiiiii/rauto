<script>
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import StatusCard from "./StatusCard.svelte";
  import WorkspaceActionHeader from "./WorkspaceActionHeader.svelte";

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
  } = $props();

  let showSummary = $derived(
    totalCount !== null || succeededCount !== null || failedCount !== null,
  );

  function itemBadgeVariant(item) {
    if (item.statusTone === "error") return "destructive";
    if (item.statusTone === "success") return "outline";
    return "secondary";
  }
</script>

<Card.Root class="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
  <WorkspaceActionHeader {title} {description} {icon}>
    {#if showSummary || customActions}
      {#snippet actions()}
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
    {/if}
  </WorkspaceActionHeader>

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
                variant={item.key === activeKey ? "secondary" : "ghost"}
                class="h-auto min-w-48 justify-start px-3 py-3 lg:min-w-0"
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

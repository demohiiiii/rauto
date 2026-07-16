<script>
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import BoxesIcon from "@lucide/svelte/icons/boxes";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import Link2Icon from "@lucide/svelte/icons/link-2";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { Handle, Position } from "@xyflow/svelte";
  import { onDestroy } from "svelte";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { classNames } from "../../lib/ui.js";

  let { data, selected = false } = $props();
  let nodeHovered = $state(false);
  let toolbarHovered = $state(false);
  let hoverHideTimer = null;
  let toolbarVisible = $derived(nodeHovered || toolbarHovered);

  function clearHoverHideTimer() {
    if (hoverHideTimer !== null) window.clearTimeout(hoverHideTimer);
    hoverHideTimer = null;
  }

  function showNodeToolbar() {
    clearHoverHideTimer();
    nodeHovered = true;
  }

  function hideNodeToolbarSoon() {
    clearHoverHideTimer();
    hoverHideTimer = window.setTimeout(() => {
      nodeHovered = false;
      toolbarHovered = false;
      hoverHideTimer = null;
    }, 120);
  }

  function enterNodeToolbar() {
    clearHoverHideTimer();
    toolbarHovered = true;
  }

  function runNodeAction(event, action) {
    event.stopPropagation();
    if (typeof action === "function") action();
  }

  onDestroy(clearHoverHideTimer);
</script>

{#if toolbarVisible}
  <div
    role="group"
    aria-label={data.titleText}
    class="tx-workflow-node-toolbar nodrag nopan absolute left-1/2 top-0 z-20 flex -translate-x-1/2 -translate-y-[calc(100%+0.625rem)] items-center gap-1 rounded-xl border border-border bg-background/95 p-1 shadow-lg backdrop-blur"
    onmouseenter={enterNodeToolbar}
    onmouseleave={hideNodeToolbarSoon}
  >
    <Button
      variant="ghost"
      size="icon-sm"
      type="button"
      title={data.moveLeftLabel}
      aria-label={data.moveLeftLabel}
      disabled={!data.canMoveLeft}
      onclick={(event) => runNodeAction(event, data.onMoveLeft)}
    >
      <ArrowLeftIcon />
    </Button>
    <Button
      variant="ghost"
      size="icon-sm"
      type="button"
      title={data.moveRightLabel}
      aria-label={data.moveRightLabel}
      disabled={!data.canMoveRight}
      onclick={(event) => runNodeAction(event, data.onMoveRight)}
    >
      <ArrowRightIcon />
    </Button>
    <Button
      variant="ghost"
      size="icon-sm"
      type="button"
      title={data.duplicateLabel}
      aria-label={data.duplicateLabel}
      onclick={(event) => runNodeAction(event, data.onDuplicate)}
    >
      <CopyIcon />
    </Button>
    <Button
      variant="ghost"
      size="icon-sm"
      type="button"
      class="text-destructive hover:text-destructive"
      title={data.deleteLabel}
      aria-label={data.deleteLabel}
      onclick={(event) => runNodeAction(event, data.onDelete)}
    >
      <Trash2Icon />
    </Button>
  </div>
{/if}

{#if data.hasTarget}
  <Handle
    type="target"
    position={data.vertical ? Position.Top : Position.Left}
    isConnectable={false}
    style="width: 0.625rem; height: 0.625rem; border: 2px solid var(--background); background: var(--primary);"
  />
{/if}

<div
  role="group"
  aria-label={data.titleText}
  class={classNames(
    "rounded-2xl border bg-card text-card-foreground shadow-sm transition-[border-color,box-shadow,transform] duration-200",
    "w-80 p-4",
    selected
      ? "border-primary shadow-lg ring-2 ring-primary/15"
      : "border-border hover:border-primary/40 hover:shadow-md",
  )}
  onmouseenter={showNodeToolbar}
  onmouseleave={hideNodeToolbarSoon}
>
  <div class="flex min-w-0 items-start gap-3">
    <span
      class={classNames(
        "flex size-10 shrink-0 items-center justify-center rounded-xl",
        selected
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-primary",
      )}
    >
      {#if data.isTemplate}
        <Link2Icon class="size-4" />
      {:else}
        <BoxesIcon class="size-4" />
      {/if}
    </span>

    <span class="min-w-0 flex-1">
      <span class="flex min-w-0 items-center justify-between gap-2">
        <span class="truncate text-sm font-semibold">{data.titleText}</span>
        {#if data.sequenceText}
          <Badge variant={selected ? "default" : "secondary"}>
            {data.sequenceText}
          </Badge>
        {/if}
      </span>
      <span class="mt-1 block truncate text-xs text-muted-foreground">
        {data.metaText}
      </span>
    </span>
  </div>

  <div class="mt-3 border-t border-border pt-3">
    {#if data.commandRows?.length}
      <div class="relative grid gap-2.5 pl-5">
        <span
          class="pointer-events-none absolute bottom-2 left-[0.3125rem] top-2 w-px bg-border"
          aria-hidden="true"
        ></span>
        {#each data.commandRows as commandRow}
          <div class="relative min-w-0">
            <span
              class="absolute -left-[1.125rem] top-1.5 size-2 rounded-full border-2 border-background bg-primary"
              aria-hidden="true"
            ></span>
            <div class="flex min-w-0 items-start justify-between gap-2">
              <span class="min-w-0">
                <span class="block text-[0.6875rem] text-muted-foreground">
                  {commandRow.titleText}
                </span>
                <span class="block truncate text-xs font-medium">
                  {commandRow.summaryText}
                </span>
              </span>
              <span class="shrink-0 text-[0.625rem] text-muted-foreground">
                {commandRow.kindText}
              </span>
            </div>
          </div>
        {/each}
      </div>
      {#if data.remainingCommandText}
        <div class="mt-2 text-right text-[0.6875rem] text-muted-foreground">
          {data.remainingCommandText}
        </div>
      {/if}
    {:else}
      <div class="text-xs text-muted-foreground">
        {data.emptyCommandText}
      </div>
    {/if}
  </div>
</div>

{#if data.hasSource}
  <Handle
    type="source"
    position={data.vertical ? Position.Bottom : Position.Right}
    isConnectable={false}
    style="width: 0.625rem; height: 0.625rem; border: 2px solid var(--background); background: var(--primary);"
  />
{/if}

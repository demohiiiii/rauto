<script>
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import NetworkIcon from "@lucide/svelte/icons/network";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { Handle, Position } from "@xyflow/svelte";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { classNames } from "../../lib/ui.js";

  let { data, selected = false } = $props();

  function runAction(event, action) {
    event.stopPropagation();
    if (typeof action === "function") action();
  }
</script>

{#if data.stageStrategy === "serial"}
  <Handle
    id="serial-in"
    type="target"
    position={Position.Top}
    isConnectable={false}
    style="width:0.5rem;height:0.5rem;border:2px solid var(--background);background:var(--primary);"
  />
{/if}

<div
  class={classNames(
    "group relative h-full w-full rounded-xl border bg-card/80 text-card-foreground shadow-sm transition-[border-color,box-shadow]",
    selected
      ? "border-primary shadow-md ring-2 ring-primary/15"
      : "border-border hover:border-primary/40",
  )}
>
  <div
    role="group"
    aria-label={data.title}
    class="nodrag nopan absolute right-2 top-0 z-30 flex -translate-y-[calc(100%+0.375rem)] items-center gap-1 rounded-xl border border-border bg-background/95 p-1 opacity-0 shadow-lg backdrop-blur transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
  >
    <Button
      variant="ghost"
      size="icon-sm"
      type="button"
      title={data.movePreviousLabel}
      aria-label={data.movePreviousLabel}
      disabled={!data.canMovePrevious}
      onclick={(event) => runAction(event, data.onMovePrevious)}
      ><ArrowUpIcon /></Button
    >
    <Button
      variant="ghost"
      size="icon-sm"
      type="button"
      title={data.moveNextLabel}
      aria-label={data.moveNextLabel}
      disabled={!data.canMoveNext}
      onclick={(event) => runAction(event, data.onMoveNext)}
      ><ArrowDownIcon /></Button
    >
    <Button
      variant="ghost"
      size="icon-sm"
      type="button"
      title={data.duplicateLabel}
      aria-label={data.duplicateLabel}
      onclick={(event) => runAction(event, data.onDuplicate)}
      ><CopyIcon /></Button
    >
    <Button
      class="text-destructive hover:text-destructive"
      variant="ghost"
      size="icon-sm"
      type="button"
      title={data.deleteLabel}
      aria-label={data.deleteLabel}
      onclick={(event) => runAction(event, data.onDelete)}
      ><Trash2Icon /></Button
    >
  </div>

  <header
    class="relative z-10 flex h-[7.25rem] min-w-0 items-start gap-3 border-b border-primary/15 bg-primary/[0.035] p-3"
  >
    <span
      class={classNames(
        "flex size-9 shrink-0 items-center justify-center rounded-lg",
        selected
          ? "bg-primary text-primary-foreground"
          : "bg-primary/10 text-primary",
      )}
    >
      <NetworkIcon class="size-4" />
    </span>
    <span class="min-w-0 flex-1">
      <span class="flex min-w-0 items-center justify-between gap-2">
        <span class="truncate text-sm font-semibold">{data.title}</span>
        <Badge variant="secondary">{data.sequenceText}</Badge>
      </span>
      <span class="mt-1 flex min-w-0 items-center gap-1.5 text-xs">
        <Badge
          variant="outline"
          class={data.sourceKind === "template"
            ? "border-amber-500/45 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : "border-emerald-500/45 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}
          >{data.sourceLabelText}</Badge
        >
        {#if data.sourceName}
          <span class="truncate text-muted-foreground">{data.sourceName}</span>
        {/if}
      </span>
      <span class="mt-2 flex min-w-0 items-center justify-between gap-2">
        <span class="truncate text-xs font-medium text-foreground">
          {data.workflowName}
        </span>
        <Badge variant="outline">{data.strategyText}</Badge>
      </span>
      <span
        class="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5 text-[0.6875rem] text-muted-foreground"
      >
        <span>{data.targetCountText}</span>
        <span>{data.blockCountText}</span>
        {#if data.unresolvedCount > 0}
          <Badge
            variant="outline"
            class="border-amber-500/40 text-amber-700 dark:text-amber-300"
          >
            {data.unresolvedText}
          </Badge>
        {/if}
      </span>
    </span>
  </header>

  <div
    class={classNames(
      "pointer-events-none absolute left-3 right-3 top-32 rounded-lg border border-dashed border-border bg-muted/15",
      data.canAddBlock ? "bottom-14" : "bottom-3",
    )}
  >
    {#if data.previewStatus === "loading"}
      <p
        class="grid h-full place-items-center px-4 text-center text-xs text-muted-foreground"
      >
        {data.previewLoadingText}
      </p>
    {:else if data.previewStatus === "error"}
      <p
        class="grid h-full place-items-center px-4 text-center text-xs text-destructive"
        title={data.previewError}
      >
        {data.previewErrorText}: {data.previewError}
      </p>
    {:else if data.emptyWorkflow}
      <p
        class="grid h-full place-items-center px-4 text-center text-xs text-muted-foreground"
      >
        {data.emptyWorkflowText}
      </p>
    {/if}
  </div>

  {#if data.canAddBlock}
    <div class="nodrag nopan absolute bottom-2.5 left-3 right-3 z-20">
      <Button
        class="w-full"
        variant="outline"
        size="sm"
        type="button"
        onclick={(event) => runAction(event, data.onAddBlock)}
      >
        <PlusIcon data-icon="inline-start" />
        {data.addBlockLabel}
      </Button>
    </div>
  {/if}
</div>

{#if data.stageStrategy === "serial"}
  <Handle
    id="serial-out"
    type="source"
    position={Position.Bottom}
    isConnectable={false}
    style="width:0.5rem;height:0.5rem;border:2px solid var(--background);background:var(--primary);"
  />
{/if}

{#if data.connectsToStageOutput}
  <Handle
    id="stage-out"
    type="source"
    position={Position.Right}
    isConnectable={false}
    style="width:0.5rem;height:0.5rem;border:2px solid var(--background);background:var(--primary);"
  />
{/if}

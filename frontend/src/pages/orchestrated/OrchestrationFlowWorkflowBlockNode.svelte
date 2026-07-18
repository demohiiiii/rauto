<script>
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import BoxesIcon from "@lucide/svelte/icons/boxes";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { Handle, Position } from "@xyflow/svelte";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { classNames } from "../../lib/ui.js";

  let { data, selected = false } = $props();
  const commandAccentClasses = [
    "border-chart-2/20 bg-chart-2/5",
    "border-chart-3/20 bg-chart-3/5",
    "border-chart-4/20 bg-chart-4/5",
    "border-chart-5/20 bg-chart-5/5",
  ];

  function runAction(event, action) {
    event.stopPropagation();
    if (typeof action === "function") action();
  }
</script>

{#if data.hasTarget}
  <Handle
    id="block-input"
    type="target"
    position={Position.Top}
    isConnectable={false}
    style="width:0.45rem;height:0.45rem;border:2px solid var(--background);background:var(--chart-2);"
  />
{/if}

<div
  data-testid="orchestration-workflow-block-node"
  class={classNames(
    "group relative flex h-full w-full min-w-0 flex-col rounded-lg border bg-background px-3 py-2 shadow-sm transition-[border-color,box-shadow]",
    selected
      ? "border-chart-2 shadow-md ring-2 ring-chart-2/15"
      : data.sourceKind === "template"
        ? "border-amber-500/35"
        : "border-border hover:border-chart-2/45",
  )}
>
  {#if data.editable}
    <div
      role="group"
      aria-label={data.title}
      class={classNames(
        "nodrag nopan absolute right-1.5 top-1.5 z-20 flex items-center gap-0.5 rounded-md border border-border bg-background/95 p-0.5 shadow-sm backdrop-blur transition-opacity",
        selected
          ? "opacity-100"
          : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
      )}
    >
      <Button
        variant="ghost"
        size="icon-xs"
        type="button"
        title={data.movePreviousLabel}
        aria-label={data.movePreviousLabel}
        disabled={!data.canMovePrevious}
        onclick={(event) => runAction(event, data.onMovePrevious)}
        ><ArrowUpIcon /></Button
      >
      <Button
        variant="ghost"
        size="icon-xs"
        type="button"
        title={data.moveNextLabel}
        aria-label={data.moveNextLabel}
        disabled={!data.canMoveNext}
        onclick={(event) => runAction(event, data.onMoveNext)}
        ><ArrowDownIcon /></Button
      >
      <Button
        variant="ghost"
        size="icon-xs"
        type="button"
        title={data.duplicateLabel}
        aria-label={data.duplicateLabel}
        onclick={(event) => runAction(event, data.onDuplicate)}
        ><CopyIcon /></Button
      >
      <Button
        class="text-destructive hover:text-destructive"
        variant="ghost"
        size="icon-xs"
        type="button"
        title={data.deleteLabel}
        aria-label={data.deleteLabel}
        onclick={(event) => runAction(event, data.onDelete)}
        ><Trash2Icon /></Button
      >
    </div>
  {/if}

  <div
    class={classNames(
      "flex min-w-0 items-center gap-3",
      data.editable ? "pr-[7.75rem]" : "",
    )}
  >
    <span
      class={classNames(
        "flex size-8 shrink-0 items-center justify-center rounded-md",
        data.sourceKind === "template"
          ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "bg-chart-2/10 text-chart-2",
      )}
    >
      <BoxesIcon class="size-4" />
    </span>
    <span class="flex min-w-0 flex-1 items-center gap-2">
      <Badge variant="secondary">{data.sequenceText}</Badge>
      <span class="truncate text-xs font-semibold text-foreground">
        {data.title}
      </span>
    </span>
  </div>

  <div class="mt-2 grid min-w-0 gap-1">
    {#each data.commandRows || [data.operationText] as command, commandIndex}
      <div
        class={classNames(
          "flex h-6 min-w-0 items-center gap-2 rounded border px-2 font-mono text-[0.6875rem] text-muted-foreground",
          commandAccentClasses[commandIndex % commandAccentClasses.length],
        )}
        title={command}
      >
        <span class="shrink-0 tabular-nums text-[0.625rem] opacity-70">
          {commandIndex + 1}
        </span>
        <span class="truncate">{command}</span>
      </div>
    {/each}
  </div>
</div>

{#if data.hasSource}
  <Handle
    id="block-output"
    type="source"
    position={Position.Bottom}
    isConnectable={false}
    style="width:0.45rem;height:0.45rem;border:2px solid var(--background);background:var(--chart-2);"
  />
{/if}

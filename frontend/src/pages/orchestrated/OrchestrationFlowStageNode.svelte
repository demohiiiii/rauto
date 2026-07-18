<script>
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import Layers3Icon from "@lucide/svelte/icons/layers-3";
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

<Handle
  id="stage-input"
  type="target"
  position={data.vertical ? Position.Top : Position.Left}
  isConnectable={false}
  style={data.vertical
    ? "width:0.625rem;height:0.625rem;border:2px solid var(--background);background:var(--primary);"
    : "top:50%;width:0.625rem;height:0.625rem;border:2px solid var(--background);background:var(--primary);"}
/>

<Handle
  id="jobs-output"
  type="target"
  position={Position.Right}
  isConnectable={false}
  style="top:50%;width:0.625rem;height:0.625rem;border:2px solid var(--background);background:var(--primary);z-index:2;"
/>

<div
  class={classNames(
    "group relative h-full w-full rounded-2xl border bg-muted/20 transition-[border-color,box-shadow]",
    selected
      ? "border-primary shadow-lg ring-2 ring-primary/15"
      : "border-border hover:border-primary/40",
  )}
>
  <div
    role="group"
    aria-label={data.title}
    class="nodrag nopan absolute left-1/2 top-0 z-30 flex -translate-x-1/2 -translate-y-[calc(100%+0.5rem)] items-center gap-1 rounded-xl border border-border bg-background/95 p-1 opacity-0 shadow-lg backdrop-blur transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
  >
    <Button
      variant="ghost"
      size="icon-sm"
      type="button"
      title={data.movePreviousLabel}
      aria-label={data.movePreviousLabel}
      disabled={!data.canMovePrevious}
      onclick={(event) => runAction(event, data.onMovePrevious)}
      ><ArrowLeftIcon /></Button
    >
    <Button
      variant="ghost"
      size="icon-sm"
      type="button"
      title={data.moveNextLabel}
      aria-label={data.moveNextLabel}
      disabled={!data.canMoveNext}
      onclick={(event) => runAction(event, data.onMoveNext)}
      ><ArrowRightIcon /></Button
    >
    <Button
      variant="ghost"
      size="icon-sm"
      type="button"
      title={data.addJobLabel}
      aria-label={data.addJobLabel}
      onclick={(event) => runAction(event, data.onAddJob)}><PlusIcon /></Button
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
    class="flex h-[4.5rem] items-center gap-3 border-b border-primary/15 bg-primary/[0.035] px-4"
  >
    <span
      class={classNames(
        "flex size-9 shrink-0 items-center justify-center rounded-lg",
        selected
          ? "bg-primary text-primary-foreground"
          : "bg-primary/10 text-primary",
      )}><Layers3Icon class="size-4" /></span
    >
    <span class="min-w-0 flex-1">
      <span
        class="mb-0.5 block text-[0.625rem] font-bold uppercase tracking-[0.16em] text-primary"
      >
        {data.sequenceText}
      </span>
      <span class="block truncate text-sm font-semibold text-foreground">
        {data.title}
      </span>
      <span class="mt-1 flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">{data.strategyText}</Badge>
        <span class="text-xs text-muted-foreground">{data.jobCountText}</span>
      </span>
    </span>
  </header>

  {#if data.empty}
    <div
      class="absolute inset-x-4 top-[5.5rem] grid justify-items-center gap-2 rounded-xl border border-dashed border-border bg-background/60 p-4 text-center"
    >
      <span class="text-xs leading-5 text-muted-foreground">
        {data.emptyHintText}
      </span>
    </div>
  {/if}

  <Button
    class="orchestration-stage-add-job nodrag nopan absolute bottom-3 left-3 right-3 w-[calc(100%-1.5rem)] border-dashed"
    variant="outline"
    size="sm"
    type="button"
    onclick={(event) => runAction(event, data.onAddJob)}
  >
    <PlusIcon data-icon="inline-start" />
    {data.addJobLabel}
  </Button>
</div>

<Handle
  id="stage-output"
  type="source"
  position={data.vertical ? Position.Bottom : Position.Right}
  isConnectable={false}
  style={data.vertical
    ? "width:0.625rem;height:0.625rem;border:2px solid var(--background);background:var(--primary);"
    : "top:50%;width:0.625rem;height:0.625rem;border:0;background:transparent;z-index:1;"}
/>

<script lang="ts">
  import Undo2Icon from "@lucide/svelte/icons/undo-2";
  import { classNames } from "$lib/ui.js";

  interface Props {
    command: string;
    commandIndex: number;
    kindText?: string;
    label?: string;
    rollback?: boolean;
  }

  let {
    command,
    commandIndex,
    kindText = "",
    label,
    rollback = false,
  }: Props = $props();

  const accentClasses = [
    "border-chart-2/20 bg-chart-2/5",
    "border-chart-3/20 bg-chart-3/5",
    "border-chart-4/20 bg-chart-4/5",
    "border-chart-5/20 bg-chart-5/5",
  ];
</script>

<div
  role={label ? "group" : undefined}
  aria-label={label}
  class={classNames(
    "flex h-6 min-w-0 items-center gap-2 rounded border px-2 font-mono text-[0.6875rem] text-muted-foreground",
    accentClasses[commandIndex % accentClasses.length],
    rollback && "border-dashed",
  )}
  title={label ? `${label}: ${command}` : command}
>
  {#if rollback}
    <Undo2Icon class="size-3 shrink-0 opacity-70" aria-hidden="true" />
  {:else}
    <span class="shrink-0 tabular-nums text-[0.625rem] opacity-70">
      {commandIndex + 1}
    </span>
  {/if}
  <span class="min-w-0 flex-1 truncate">{command}</span>
  {#if kindText}
    <span class="shrink-0 font-sans text-[0.625rem]">{kindText}</span>
  {/if}
</div>

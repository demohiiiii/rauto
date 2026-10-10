<script lang="ts">
  import Undo2Icon from "@lucide/svelte/icons/undo-2";
  import { classNames } from "$lib/ui.js";
  import {
    FLOW_COMMAND_LINE_HEIGHT,
    flowCommandLines,
    flowCommandRowHeight,
  } from "./flowWorkflowLayout.js";

  interface Props {
    command: string;
    commandIndex: number;
    height?: number;
    kindText?: string;
    label?: string;
    rollback?: boolean;
  }

  let {
    command,
    commandIndex,
    height,
    kindText = "",
    label,
    rollback = false,
  }: Props = $props();

  let lines = $derived(flowCommandLines(command));
</script>

<div
  role={label ? "group" : undefined}
  aria-label={label}
  class={classNames(
    "flex min-w-0 items-start gap-2 rounded border px-2 py-[3px] font-mono text-[0.6875rem] text-foreground/80",
    rollback
      ? "border-dashed border-amber-500/35 bg-amber-500/10"
      : "border-primary/25 bg-primary/5",
  )}
  style:height={`${height ?? flowCommandRowHeight(command)}px`}
  style:line-height={`${FLOW_COMMAND_LINE_HEIGHT}px`}
  title={label ? `${label}: ${command}` : command}
>
  {#if rollback}
    <Undo2Icon
      class="mt-0.5 size-3 shrink-0 text-amber-700 dark:text-amber-300"
      aria-hidden="true"
    />
  {:else}
    <span class="shrink-0 tabular-nums text-[0.625rem] text-primary">
      {commandIndex + 1}
    </span>
  {/if}
  <span class="min-w-0 flex-1">
    {#each lines as line}
      <span
        class="block truncate whitespace-pre"
        style:height={`${FLOW_COMMAND_LINE_HEIGHT}px`}>{line}</span
      >
    {/each}
  </span>
  {#if kindText}
    <span class="shrink-0 font-sans text-[0.625rem]">{kindText}</span>
  {/if}
</div>

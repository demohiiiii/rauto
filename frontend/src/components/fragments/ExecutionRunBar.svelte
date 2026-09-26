<script lang="ts">
  import { getContext, type Snippet } from "svelte";
  import {
    executionDockKey,
    type ExecutionDockContext,
  } from "./executionDockContext.js";
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import PlayIcon from "@lucide/svelte/icons/play";
  import CommandOutputDownloadControl from "./CommandOutputDownloadControl.svelte";
  import LoadingButton from "./LoadingButton.svelte";
  import { cn } from "$lib/utils.js";

  interface Props {
    buttonLabel: string;
    hint: string;
    autoDownloadOutput?: boolean;
    onAutoDownloadOutputChange?: (value: boolean) => void;
    title?: string;
    summary?: Snippet;
    actions?: Snippet;
    className?: string;
    compact?: boolean;
    docked?: boolean;
    active?: boolean;
    loading?: boolean;
    showAutoDownloadOutput?: boolean;
    disabled?: boolean;
    onRun: () => void;
  }

  let {
    buttonLabel,
    hint,
    autoDownloadOutput = false,
    onAutoDownloadOutputChange = () => {},
    title = "",
    summary,
    actions,
    className = "",
    compact = false,
    docked = false,
    active = true,
    loading = false,
    showAutoDownloadOutput = true,
    disabled = false,
    onRun,
  }: Props = $props();
  let effectiveCompact = $derived(compact || docked);
  const dock = getContext<ExecutionDockContext | undefined>(executionDockKey);
  $effect(() => {
    if (docked && active && dock) return dock.register(footer);
  });
</script>

{#snippet footer()}
  <footer
    data-execution-runbar
    class={cn(
      "sticky bottom-3 z-10 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background/95 p-3 shadow-lg shadow-black/5 backdrop-blur-md sm:px-5",
      docked &&
        "static min-h-16 h-auto w-max max-w-full flex-nowrap py-2 sm:px-3",
      className,
    )}
  >
    {#if !effectiveCompact}
      <div class="flex min-w-0 items-center gap-3">
        <div
          class="hidden size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:flex"
          aria-hidden="true"
        >
          <ArrowRightIcon class="size-4" />
        </div>
        <div class="min-w-0">
          <p class="text-sm font-medium">
            {#if summary}{@render summary()}{:else}{title}{/if}
          </p>
          <p class="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
    {/if}
    <div
      class={docked
        ? "flex min-w-0 flex-wrap items-center justify-end gap-2 sm:flex-nowrap"
        : "flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto"}
    >
      {#if showAutoDownloadOutput}
        <CommandOutputDownloadControl
          checked={autoDownloadOutput}
          onCheckedChange={onAutoDownloadOutputChange}
        />
      {/if}
      {@render actions?.()}
      <LoadingButton
        variant="default"
        size="lg"
        class="flex-1 sm:flex-none"
        {loading}
        {disabled}
        onclick={onRun}
      >
        {#if !loading}<PlayIcon data-icon="inline-start" />{/if}{buttonLabel}
      </LoadingButton>
    </div>
  </footer>
{/snippet}
{#if !docked || !dock}{@render footer()}{/if}

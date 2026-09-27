<script lang="ts">
  import { getContext, type Snippet } from "svelte";
  import {
    executionDockKey,
    type ExecutionDockContext,
  } from "./executionDockContext.js";
  import PlayIcon from "@lucide/svelte/icons/play";
  import CommandOutputDownloadControl from "./CommandOutputDownloadControl.svelte";
  import LoadingButton from "./LoadingButton.svelte";

  interface Props {
    buttonLabel: string;
    autoDownloadOutput?: boolean;
    onAutoDownloadOutputChange?: (value: boolean) => void;
    actions?: Snippet;
    active?: boolean;
    loading?: boolean;
    showAutoDownloadOutput?: boolean;
    disabled?: boolean;
    onRun: () => void;
  }

  let {
    buttonLabel,
    autoDownloadOutput = false,
    onAutoDownloadOutputChange = () => {},
    actions,
    active = true,
    loading = false,
    showAutoDownloadOutput = true,
    disabled = false,
    onRun,
  }: Props = $props();
  const dock = getContext<ExecutionDockContext | undefined>(executionDockKey);
  $effect(() => {
    if (active && dock) return dock.register(footer);
  });
</script>

{#snippet footer()}
  <footer
    data-execution-runbar
    class="static z-10 flex h-auto min-h-16 w-max min-w-0 max-w-full flex-nowrap items-center justify-between gap-3 rounded-2xl border border-border bg-background/95 px-3 py-2 shadow-lg shadow-black/5 backdrop-blur-md"
  >
    <div
      class="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:flex-nowrap"
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
{#if !dock && active}{@render footer()}{/if}

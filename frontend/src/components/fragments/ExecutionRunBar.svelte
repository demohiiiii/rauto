<script lang="ts">
  import type { Snippet } from "svelte";
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import PlayIcon from "@lucide/svelte/icons/play";
  import CommandOutputDownloadControl from "./CommandOutputDownloadControl.svelte";
  import LoadingButton from "./LoadingButton.svelte";

  interface Props {
    buttonLabel: string;
    hint: string;
    autoDownloadOutput: boolean;
    onAutoDownloadOutputChange: (value: boolean) => void;
    title?: string;
    summary?: Snippet;
    actions?: Snippet;
    loading?: boolean;
    disabled?: boolean;
    onRun: () => void;
  }

  let {
    buttonLabel,
    hint,
    autoDownloadOutput,
    onAutoDownloadOutputChange,
    title = "",
    summary,
    actions,
    loading = false,
    disabled = false,
    onRun,
  }: Props = $props();
</script>

<footer
  data-execution-runbar
  class="sticky bottom-3 z-10 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background/95 p-3 shadow-lg shadow-black/5 backdrop-blur-md sm:px-5"
>
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
  <div class="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
    <CommandOutputDownloadControl
      checked={autoDownloadOutput}
      onCheckedChange={onAutoDownloadOutputChange}
    />
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

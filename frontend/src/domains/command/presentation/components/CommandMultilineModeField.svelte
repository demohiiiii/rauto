<script lang="ts">
  import ListOrderedIcon from "@lucide/svelte/icons/list-ordered";
  import SquareTerminalIcon from "@lucide/svelte/icons/square-terminal";
  import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";
  import type { CommandFlowMultilineMode } from "$domains/command/index.js";
  import { t } from "$lib/i18n.js";

  interface Props {
    disabled?: boolean;
    labelText?: string;
    onValueChange?: (value: CommandFlowMultilineMode) => void;
    value?: CommandFlowMultilineMode;
  }

  let {
    value = "split_lines",
    disabled = false,
    labelText = t("commandMultilineMode"),
    onValueChange,
  }: Props = $props();

  function changeValue(nextValue: string): void {
    if (nextValue === "split_lines" || nextValue === "whole") {
      onValueChange?.(nextValue);
    }
  }
</script>

<div class="flex min-w-0 items-center">
  <ToggleGroup.Root
    type="single"
    size="sm"
    spacing={1}
    class="relative isolate grid grid-cols-2 gap-0 rounded-full border border-border/70 bg-muted/60 p-1"
    bind:value={() => value, changeValue}
    {disabled}
    aria-label={labelText}
  >
    <span
      aria-hidden="true"
      class="pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/2)] rounded-full border border-primary/20 bg-background shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none"
      class:translate-x-full={value === "whole"}
      class:opacity-50={disabled}
    ></span>
    <ToggleGroup.Item
      value="split_lines"
      class="relative z-10 h-7 gap-1.5 rounded-full px-2 text-xs text-muted-foreground transition-colors hover:bg-transparent aria-pressed:bg-transparent data-[state=on]:bg-transparent data-[state=on]:text-primary sm:px-3"
      aria-label={t("commandMultilineModeSplitLines")}
      title={t("commandMultilineModeSplitLinesHint")}
    >
      <ListOrderedIcon class="size-3.5" aria-hidden="true" />
      {t("commandMultilineModeSplitLinesShort")}
    </ToggleGroup.Item>
    <ToggleGroup.Item
      value="whole"
      class="relative z-10 h-7 gap-1.5 rounded-full px-2 text-xs text-muted-foreground transition-colors hover:bg-transparent aria-pressed:bg-transparent data-[state=on]:bg-transparent data-[state=on]:text-primary sm:px-3"
      aria-label={t("commandMultilineModeWhole")}
      title={t("commandMultilineModeWholeHint")}
    >
      <SquareTerminalIcon class="size-3.5" aria-hidden="true" />
      {t("commandMultilineModeWholeShort")}
    </ToggleGroup.Item>
  </ToggleGroup.Root>
</div>

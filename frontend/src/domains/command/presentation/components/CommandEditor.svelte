<script lang="ts">
  import type { Snippet } from "svelte";
  import type { CommandFlowMultilineMode } from "$domains/command/index.js";
  import { t } from "$lib/i18n.js";
  import CommandMultilineModeField from "./CommandMultilineModeField.svelte";
  import CommandTextAreaField from "./CommandTextAreaField.svelte";

  interface Props {
    children?: Snippet;
    modeField?: Snippet;
    command?: string;
    commandLabel?: string;
    multilineMode?: CommandFlowMultilineMode;
    onCommandChange?: (value: string) => void;
    onMultilineModeChange?: (value: CommandFlowMultilineMode) => void;
    placeholderText?: string;
    readonly?: boolean;
  }

  let {
    children,
    modeField,
    command = "",
    commandLabel = "",
    multilineMode = "split_lines",
    onCommandChange,
    onMultilineModeChange,
    placeholderText = "",
    readonly = false,
  }: Props = $props();
</script>

<div data-command-editor class="grid min-w-0 gap-3">
  <label class="grid min-w-0 gap-2">
    <span class="text-sm font-medium text-foreground">
      {commandLabel || t("txBlockFormCommand")}
    </span>
    <CommandTextAreaField
      value={command}
      {readonly}
      {placeholderText}
      onValueInput={onCommandChange}
    />
  </label>

  <div
    class={modeField
      ? "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:gap-3"
      : "flex min-w-0 items-center"}
  >
    {@render modeField?.()}
    <CommandMultilineModeField
      value={multilineMode}
      onValueChange={onMultilineModeChange}
    />
  </div>

  {@render children?.()}
</div>

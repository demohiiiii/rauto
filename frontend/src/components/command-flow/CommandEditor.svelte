<script lang="ts">
  import type { Snippet } from "svelte";
  import type { CommandFlowMultilineMode } from "$domains/command/index.js";
  import { t } from "../../lib/i18n.js";
  import CommandMultilineModeField from "./CommandMultilineModeField.svelte";
  import CommandTextAreaField from "./CommandTextAreaField.svelte";

  interface Props {
    children?: Snippet;
    command?: string;
    commandLabel?: string;
    multilineMode?: CommandFlowMultilineMode;
    onCommandChange?: (value: string) => void;
    onMultilineModeChange?: (value: CommandFlowMultilineMode) => void;
    placeholderText?: string;
  }

  let {
    children,
    command = "",
    commandLabel = "",
    multilineMode = "split_lines",
    onCommandChange,
    onMultilineModeChange,
    placeholderText = "",
  }: Props = $props();
</script>

<div data-command-editor class="grid min-w-0 gap-3">
  <label class="grid min-w-0 gap-2">
    <span class="text-sm font-medium text-foreground">
      {commandLabel || t("txBlockFormCommand")}
    </span>
    <CommandTextAreaField
      value={command}
      {placeholderText}
      onValueInput={onCommandChange}
    />
  </label>

  <CommandMultilineModeField
    value={multilineMode}
    onValueChange={onMultilineModeChange}
  />

  {@render children?.()}
</div>

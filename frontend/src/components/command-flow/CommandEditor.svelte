<script>
  import { t } from "../../lib/i18n.js";
  import CommandMultilineModeField from "./CommandMultilineModeField.svelte";
  import CommandTextAreaField from "./CommandTextAreaField.svelte";

  let {
    children,
    command = "",
    commandLabel = "",
    multilineMode = "split_lines",
    onCommandChange,
    onMultilineModeChange,
    placeholderText = "",
  } = $props();
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
    value={multilineMode === "whole" ? "whole" : "split_lines"}
    onValueChange={onMultilineModeChange}
  />

  {@render children?.()}
</div>

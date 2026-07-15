<script>
  import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";
  import { t } from "../../lib/i18n.js";

  let {
    value = "split_lines",
    disabled = false,
    labelText = t("commandMultilineMode"),
    onValueChange,
  } = $props();

  function changeValue(nextValue) {
    if (nextValue === "split_lines" || nextValue === "whole") {
      onValueChange?.(nextValue);
    }
  }
</script>

<div class="grid min-w-0 gap-2">
  <span class="text-sm font-medium text-foreground">{labelText}</span>
  <ToggleGroup.Root
    type="single"
    variant="outline"
    size="sm"
    class="grid w-full grid-cols-2"
    {value}
    {disabled}
    onValueChange={changeValue}
    aria-label={labelText}
  >
    <ToggleGroup.Item
      value="split_lines"
      aria-label={t("commandMultilineModeSplitLines")}
      title={t("commandMultilineModeSplitLinesHint")}
    >
      {t("commandMultilineModeSplitLines")}
    </ToggleGroup.Item>
    <ToggleGroup.Item
      value="whole"
      aria-label={t("commandMultilineModeWhole")}
      title={t("commandMultilineModeWholeHint")}
    >
      {t("commandMultilineModeWhole")}
    </ToggleGroup.Item>
  </ToggleGroup.Root>
</div>

<script>
  import ValueTextSelectField from "../fragments/ValueTextSelectField.svelte";
  import { currentLanguageState, t } from "../../lib/i18n.js";
  import { MANUAL_COMMAND_SOURCE } from "../../modules/commandTemplateCatalog.js";

  let {
    disabled = false,
    onValueChange,
    optionValues = [],
    showLabel = true,
    value = MANUAL_COMMAND_SOURCE,
  } = $props();
  let optionRows = $derived.by(() => {
    $currentLanguageState;
    return [
      {
        labelText: t("commandSourceManual"),
        valueText: MANUAL_COMMAND_SOURCE,
      },
      ...(Array.isArray(optionValues) ? optionValues : []).map((name) => ({
        labelText: name,
        valueText: name,
      })),
    ];
  });
</script>

<div data-command-template-source class="grid min-w-0 gap-2">
  {#if showLabel}
    <div>
      <div class="text-sm font-medium text-foreground">
        {t("commandSourceLabel")}
      </div>
      <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
        {t("commandSourceHint")}
      </p>
    </div>
  {/if}
  <ValueTextSelectField
    title={t("commandSourceLabel")}
    aria-label={t("commandSourceLabel")}
    {value}
    {disabled}
    {optionRows}
    {onValueChange}
  />
</div>

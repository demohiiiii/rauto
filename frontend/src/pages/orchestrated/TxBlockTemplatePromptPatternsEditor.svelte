<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import { t } from "../../lib/i18n.js";

  let { patternRows, onAddPattern, onPatternInput, onRemovePattern } = $props();
</script>

<div class="grid gap-3">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <span>{t("txBlockFormPatternsPlaceholder")}</span>
    <Button variant="outline" size="xs" type="button" onclick={onAddPattern}>
      {t("txBlockFormAddPrompt")}
    </Button>
  </div>
  {#each patternRows as patternRow}
    <div class="grid gap-2 md:grid-cols-[1fr_auto]">
      <PlainInputField
        class="font-mono"
        placeholderText={t("txBlockFormPatternsPlaceholder")}
        value={patternRow.patternText}
        onInput={onPatternInput(patternRow.index)}
      />
      <Button
        variant="destructive"
        size="xs"
        type="button"
        onclick={onRemovePattern(patternRow.index)}
      >
        {t("deleteBtn")}
      </Button>
    </div>
  {/each}
</div>

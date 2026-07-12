<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import { t } from "../../lib/i18n.js";
  import { txBlockValidationErrorText } from "../../modules/transactionBlockDisplayState.js";

  let {
    patternRows,
    onAddPattern,
    onPatternInput,
    onRemovePattern,
    validationErrors = [],
    pathPrefix = "",
  } = $props();
  let patternsErrorText = $derived(
    txBlockValidationErrorText(validationErrors, pathPrefix),
  );

  function invalidPatternControl(node, invalid) {
    function syncInvalidState(nextInvalid) {
      const control = node.querySelector("input");
      if (!control) return;
      if (nextInvalid) {
        control.setAttribute("aria-invalid", "true");
      } else {
        control.removeAttribute("aria-invalid");
      }
    }

    syncInvalidState(invalid);
    return { update: syncInvalidState };
  }
</script>

<div class="grid gap-3">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <span>{t("txBlockFormPatternsPlaceholder")}</span>
    <Button variant="outline" size="xs" type="button" onclick={onAddPattern}>
      {t("txBlockFormAddPrompt")}
    </Button>
  </div>
  {#if patternsErrorText}
    <p class="text-xs text-destructive" role="alert">{patternsErrorText}</p>
  {/if}
  {#each patternRows as patternRow}
    <div
      class="grid gap-2 md:grid-cols-[1fr_auto]"
      use:invalidPatternControl={!!patternsErrorText}
    >
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

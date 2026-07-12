<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import { t } from "../../lib/i18n.js";
  import { createTxBlockCommandDynParamsEditorWorkspace } from "../../modules/transactionBlockDisplays.js";

  let { command, commandDisplay, onChange } = $props();
  const txBlockCommandDynParamsEditorWorkspace =
    createTxBlockCommandDynParamsEditorWorkspace();
  const {
    dynParamsActionHandlersStateStore,
    dynParamsDisplayStateStore,
    setDynParamsContext,
  } = txBlockCommandDynParamsEditorWorkspace;
  let dynParamActionHandlers = $derived($dynParamsActionHandlersStateStore);
  let dynParamsDisplay = $derived($dynParamsDisplayStateStore);

  $effect(() => {
    setDynParamsContext({ command, commandDisplay, onChange });
  });
</script>

<div class="grid gap-3">
  <div class="grid gap-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <span>{t("txBlockFormDynParamsExtra")}</span>
      <Button
        variant="outline"
        size="sm"
        type="button"
        onclick={dynParamActionHandlers.addExtraParam}
      >
        {t("txBlockFormAddVar")}
      </Button>
    </div>

    {#if dynParamsDisplay.dynParamExtraRows.length > 0}
      <div class="grid gap-2">
        {#each dynParamsDisplay.dynParamExtraRows as dynParamRow}
          <div class="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <PlainInputField
              class="font-mono"
              placeholderText={t("txBlockFormNamePlaceholder")}
              value={dynParamRow.keyText}
              onInput={dynParamActionHandlers.extraParamKeyHandler(
                dynParamRow.keyText,
              )}
            />
            <PlainInputField
              class="font-mono"
              placeholderText={t("connectionVarValuePlaceholder")}
              value={dynParamRow.valueText}
              onInput={dynParamActionHandlers.extraParamValueHandler(
                dynParamRow.keyText,
              )}
            />
            <Button
              variant="destructive"
              size="sm"
              type="button"
              onclick={dynParamActionHandlers.removeExtraParamHandler(
                dynParamRow.keyText,
              )}
            >
              {t("deleteBtn")}
            </Button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

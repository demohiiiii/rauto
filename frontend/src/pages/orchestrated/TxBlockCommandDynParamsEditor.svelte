<script>
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button/index.js";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import PresenceToggle from "../../components/fragments/PresenceToggle.svelte";
  import { t } from "../../lib/i18n.js";
  import TxFormSection from "./TxFormSection.svelte";
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

<Card.Root class="rounded-2xl bg-muted/30">
  <Card.Header>
    <Card.Title class="sr-only">{t("txBlockFormDynParams")}</Card.Title>
    <div class="flex items-start justify-between gap-4">
      <TxFormSection
        class="min-w-0 flex-1"
        icon={SparklesIcon}
        title={t("txBlockFormDynParams")}
        description={t("txBlockFormDynParamsHint")}
      />
      <PresenceToggle
        checked={dynParamsDisplay.dynParamsPresent}
        onChange={dynParamActionHandlers.dynParamsPresenceHandler()}
        labelText={dynParamsDisplay.dynParamsPresent
          ? t("enabled")
          : t("disabled")}
        showLabel={true}
      />
    </div>
  </Card.Header>
  <Card.Content>
    {#if dynParamsDisplay.dynParamsPresent}
      <div class="grid gap-3">
        <div class="grid gap-3 md:grid-cols-2">
          <label class="flex flex-col gap-2">
            <div class="mb-1 flex items-center justify-between gap-3">
              <span class="text-sm font-medium text-foreground">
                {t("fieldEnablePassword")}
              </span>
              <PresenceToggle
                checked={dynParamsDisplay.dynParamEnablePasswordPresent}
                onChange={dynParamActionHandlers.specialFieldPresenceHandler(
                  "enablePassword",
                )}
              />
            </div>
            <PlainInputField
              type="password"
              value={dynParamsDisplay.dynParamEnablePasswordValue}
              onInput={dynParamActionHandlers.specialFieldValueHandler(
                "enablePassword",
              )}
              disabled={!dynParamsDisplay.dynParamEnablePasswordPresent}
            />
          </label>
          <label class="flex flex-col gap-2">
            <div class="mb-1 flex items-center justify-between gap-3">
              <span class="text-sm font-medium text-foreground">
                {t("fieldSudoPassword")}
              </span>
              <PresenceToggle
                checked={dynParamsDisplay.dynParamSudoPasswordPresent}
                onChange={dynParamActionHandlers.specialFieldPresenceHandler(
                  "sudoPassword",
                )}
              />
            </div>
            <PlainInputField
              type="password"
              value={dynParamsDisplay.dynParamSudoPasswordValue}
              onInput={dynParamActionHandlers.specialFieldValueHandler(
                "sudoPassword",
              )}
              disabled={!dynParamsDisplay.dynParamSudoPasswordPresent}
            />
          </label>
        </div>

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
    {/if}
  </Card.Content>
</Card.Root>

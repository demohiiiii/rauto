<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import { t } from "../../lib/i18n.js";
  import { createTxBlockTemplateVarOptionsEditorWorkspace } from "../../modules/transactionBlockTemplateWorkspaces.js";

  let { operation, variableRow, onChange } = $props();
  const txBlockTemplateVarOptionsEditorWorkspace =
    createTxBlockTemplateVarOptionsEditorWorkspace();
  const {
    optionActionHandlersStateStore,
    optionRowsStateStore,
    setTemplateVarOptionsContext,
  } = txBlockTemplateVarOptionsEditorWorkspace;
  let optionActionHandlers = $derived($optionActionHandlersStateStore);
  let optionRows = $derived($optionRowsStateStore);

  $effect(() => {
    setTemplateVarOptionsContext({ operation, variableRow, onChange });
  });
</script>

<div class="grid gap-2 rounded-lg bg-slate-50 p-2 md:col-span-2">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <span>{t("txBlockFormOptionsPlaceholder")}</span>
    <Button
      variant="outline"
      size="xs"
      type="button"
      onclick={optionActionHandlers.addOption}
    >
      {t("txBlockFormAddVar")}
    </Button>
  </div>
  {#each optionRows as optionRow}
    <div class="grid gap-2 md:grid-cols-[1fr_auto]">
      <PlainInputField
        class="font-mono"
        value={optionRow.valueText}
        onInput={optionActionHandlers.optionValueHandler(optionRow.index)}
      />
      <Button
        variant="destructive"
        size="xs"
        type="button"
        onclick={optionActionHandlers.removeOptionHandler(optionRow.index)}
      >
        {t("deleteBtn")}
      </Button>
    </div>
  {/each}
</div>

<script>
  import PresenceToggle from "../../components/fragments/PresenceToggle.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { t } from "../../lib/i18n.js";
  import TxBlockTemplateVarEditor from "./TxBlockTemplateVarEditor.svelte";
  import { createTxBlockTemplateVarsEditorWorkspace } from "../../modules/transactionBlockTemplateWorkspaces.js";

  let {
    operation,
    templateDisplay,
    onChange,
    present = true,
    jsonValueTypeRows,
    templateVarTypeRows,
  } = $props();
  const txBlockTemplateVarsEditorWorkspace =
    createTxBlockTemplateVarsEditorWorkspace();
  const {
    presentStateStore,
    setTemplateVarsContext,
    templateDisplayStateStore,
    templateVarActionHandlersStateStore,
  } = txBlockTemplateVarsEditorWorkspace;
  let syncedTemplateDisplay = $derived($templateDisplayStateStore);
  let syncedPresent = $derived($presentStateStore);
  let templateVarActionHandlers = $derived(
    $templateVarActionHandlersStateStore,
  );

  $effect(() => {
    setTemplateVarsContext({ operation, onChange, present });
  });
</script>

<div class="grid gap-4">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex flex-wrap items-center gap-3">
      <span>{t("txBlockFormTemplateVars")}</span>
      <PresenceToggle
        checked={syncedPresent}
        onChange={templateVarActionHandlers.presenceHandler()}
      />
    </div>
    <Button size="sm" type="button" onclick={templateVarActionHandlers.addVar}>
      {t("txBlockFormAddVar")}
    </Button>
  </div>
  {#if syncedPresent || syncedTemplateDisplay.varRows.length > 0}
    {#each syncedTemplateDisplay.varRows as variableRow}
      <TxBlockTemplateVarEditor
        {operation}
        {variableRow}
        {onChange}
        {jsonValueTypeRows}
        {templateVarTypeRows}
      />
    {/each}
  {/if}
</div>

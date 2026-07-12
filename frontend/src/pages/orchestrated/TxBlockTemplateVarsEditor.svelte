<script>
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
    validationErrors = [],
    pathPrefix = "",
  } = $props();
  const txBlockTemplateVarsEditorWorkspace =
    createTxBlockTemplateVarsEditorWorkspace();
  const {
    setTemplateVarsContext,
    templateDisplayStateStore,
    templateVarActionHandlersStateStore,
  } = txBlockTemplateVarsEditorWorkspace;
  let syncedTemplateDisplay = $derived($templateDisplayStateStore);
  let templateVarActionHandlers = $derived(
    $templateVarActionHandlersStateStore,
  );

  $effect(() => {
    setTemplateVarsContext({ operation, onChange, present });
  });
</script>

<div class="grid gap-4">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <span>{t("txBlockFormTemplateVars")}</span>
    <Button size="sm" type="button" onclick={templateVarActionHandlers.addVar}>
      {t("txBlockFormAddVar")}
    </Button>
  </div>
  {#each syncedTemplateDisplay.varRows as variableRow}
    <TxBlockTemplateVarEditor
      {operation}
      {variableRow}
      {onChange}
      {jsonValueTypeRows}
      {templateVarTypeRows}
      {validationErrors}
      pathPrefix={`${pathPrefix}[${variableRow.varIndex}]`}
    />
  {/each}
</div>

<script>
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PresenceToggle from "../../components/fragments/PresenceToggle.svelte";
  import { t } from "../../lib/i18n.js";
  import TxBlockTemplateDefinitionEditor from "./TxBlockTemplateDefinitionEditor.svelte";
  import { createTxBlockTemplateEditorWorkspace } from "../../modules/transactionBlockTemplateWorkspaces.js";
  import TxBlockTemplateRuntimeEditor from "./TxBlockTemplateRuntimeEditor.svelte";
  import TxBlockTemplateStepsEditor from "./TxBlockTemplateStepsEditor.svelte";
  import TxBlockTemplateVarsEditor from "./TxBlockTemplateVarsEditor.svelte";

  let {
    operation,
    onChange,
    booleanRows,
    jsonValueTypeRows,
    templateVarTypeRows,
  } = $props();
  const txBlockTemplateEditorWorkspace = createTxBlockTemplateEditorWorkspace();
  const {
    setTemplateEditorContext,
    templateActionHandlersStateStore,
    templateDisplayStateStore,
  } = txBlockTemplateEditorWorkspace;
  let templateActionHandlers = $derived($templateActionHandlersStateStore);
  let templateDisplay = $derived($templateDisplayStateStore);

  $effect(() => {
    setTemplateEditorContext({ operation, onChange });
  });
</script>

<div class="grid gap-4">
  <TxBlockTemplateDefinitionEditor
    {operation}
    {onChange}
    {booleanRows}
    {jsonValueTypeRows}
  />

  <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <div
      class="mb-3 flex items-center justify-between gap-3 text-sm font-semibold text-slate-700"
    >
      <span>{t("txBlockFormTemplateRuntime")}</span>
      <PresenceToggle
        checked={templateDisplay.runtime.present}
        onChange={templateActionHandlers.runtimePresenceHandler()}
      />
    </div>
    {#if templateDisplay.runtime.present}
      <TxBlockTemplateRuntimeEditor
        {operation}
        {templateDisplay}
        {onChange}
        {jsonValueTypeRows}
      />
    {/if}
  </div>

  <TxBlockTemplateVarsEditor
    {operation}
    {templateDisplay}
    {onChange}
    present={operation.template.template.hasVars ||
      templateDisplay.varRows.length > 0}
    {jsonValueTypeRows}
    {templateVarTypeRows}
  />

  <TxBlockTemplateStepsEditor
    {operation}
    {templateDisplay}
    {onChange}
    present={operation.template.template.hasSteps ||
      templateDisplay.stepRows.length > 0}
    {jsonValueTypeRows}
  />

  <JsonObjectFieldsEditor
    title={t("txBlockFormTemplateOperationExtra")}
    source={operation.template.extra}
    typeRows={jsonValueTypeRows}
    onChange={templateActionHandlers.setExtra}
  />
</div>

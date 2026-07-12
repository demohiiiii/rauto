<script>
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import CollapsibleGroup from "../../components/fragments/CollapsibleGroup.svelte";
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
    validationErrors = [],
    pathPrefix = "",
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

  function templateScopeKey(suffix) {
    return `tx-block-template-${pathPrefix || "operation"}-${suffix}`;
  }
</script>

<div class="grid gap-4">
  <CollapsibleGroup
    variant="section"
    label={t("txBlockFormTemplateDefinition")}
    persistenceKey={templateScopeKey("definition")}
    body-class="pt-3"
  >
    {#snippet header()}
      <div class="min-w-0 flex-1">
        <div class="text-sm font-semibold text-foreground">
          {t("txBlockFormTemplateDefinition")}
        </div>
        <div class="text-xs text-muted-foreground">
          {operation.template.template.name || t("txBlockFormTemplateName")}
        </div>
      </div>
    {/snippet}
    <TxBlockTemplateDefinitionEditor
      {operation}
      {onChange}
      {booleanRows}
      {jsonValueTypeRows}
      {validationErrors}
      pathPrefix={`${pathPrefix}.template`}
    />
  </CollapsibleGroup>

  <CollapsibleGroup
    variant="section"
    label={t("txBlockFormTemplateVars")}
    persistenceKey={templateScopeKey("variables")}
    body-class="pt-3"
  >
    {#snippet header()}
      <div class="min-w-0 flex-1">
        <div class="text-sm font-semibold text-foreground">
          {t("txBlockFormTemplateVars")}
        </div>
        <div class="text-xs text-muted-foreground">
          {templateDisplay.varRows.length}
        </div>
      </div>
    {/snippet}
    <TxBlockTemplateVarsEditor
      {operation}
      {templateDisplay}
      {onChange}
      {jsonValueTypeRows}
      {templateVarTypeRows}
      {validationErrors}
      pathPrefix={`${pathPrefix}.template.vars`}
    />
  </CollapsibleGroup>

  <CollapsibleGroup
    variant="section"
    label={t("txBlockFormTemplateSteps")}
    persistenceKey={templateScopeKey("steps")}
    body-class="pt-3"
  >
    {#snippet header()}
      <div class="min-w-0 flex-1">
        <div class="text-sm font-semibold text-foreground">
          {t("txBlockFormTemplateSteps")}
        </div>
        <div class="text-xs text-muted-foreground">
          {templateDisplay.stepRows.length}
        </div>
      </div>
    {/snippet}
    <TxBlockTemplateStepsEditor
      {operation}
      {templateDisplay}
      {onChange}
      {jsonValueTypeRows}
      {validationErrors}
      pathPrefix={`${pathPrefix}.template.steps`}
    />
  </CollapsibleGroup>

  <CollapsibleGroup
    variant="section"
    label={t("txBlockFormTemplateRuntime")}
    persistenceKey={templateScopeKey("runtime")}
    body-class="pt-3"
  >
    {#snippet header()}
      <div class="min-w-0 flex-1">
        <div class="text-sm font-semibold text-foreground">
          {t("txBlockFormTemplateRuntime")}
        </div>
      </div>
    {/snippet}
    <TxBlockTemplateRuntimeEditor
      {operation}
      {templateDisplay}
      {onChange}
      {jsonValueTypeRows}
      {validationErrors}
      pathPrefix={`${pathPrefix}.runtime`}
    />
  </CollapsibleGroup>

  <JsonObjectFieldsEditor
    title={t("txBlockFormTemplateOperationExtra")}
    source={operation.template.extra}
    typeRows={jsonValueTypeRows}
    onChange={templateActionHandlers.setExtra}
  />
</div>

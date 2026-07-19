<script>
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PlainSelectField from "../../components/fragments/PlainSelectField.svelte";
  import { t } from "../../lib/i18n.js";
  import { createOrchestrationTxWorkflowSourceWorkspace } from "../../modules/orchestration/orchestrationEditorState.js";
  import TxJsonFormSurface from "./TxJsonFormSurface.svelte";
  import TxWorkflowVisualEditor from "./TxWorkflowVisualEditor.svelte";

  let {
    sourceValue = "",
    txWorkflow,
    visualDisplay,
    sourceBindings,
    templateOptions = [],
    templateError = "",
    settingsOnly = false,
  } = $props();

  const sourceWorkspace = createOrchestrationTxWorkflowSourceWorkspace();
  let editorDisplayModeStore = $derived(sourceWorkspace.editorDisplayModeStore);
  let formModelStore = $derived(sourceWorkspace.formModelStore);
  let formErrorStore = $derived(sourceWorkspace.formErrorStore);
  let sourceDisplayStateStore = $derived(
    sourceWorkspace.sourceDisplayStateStore,
  );
  let editorDisplayMode = $derived($editorDisplayModeStore);
  let txWorkflowFormModel = $derived($formModelStore);
  let txWorkflowFormError = $derived($formErrorStore);
  let sourceDisplay = $derived($sourceDisplayStateStore);
  let primaryFieldValueHandler = $derived(
    sourceWorkspace.primaryFieldChangeHandler("json"),
  );
  let isTemplateSource = $derived(sourceValue === "workflow_template_name");

  $effect(() => {
    sourceWorkspace.setSourceContext({
      sourceBindings,
      sourceValue: isTemplateSource ? "" : "",
      txWorkflow: isTemplateSource ? {} : txWorkflow,
    });
  });
</script>

{#if isTemplateSource}
  <div class="flex flex-col gap-2 md:col-span-2">
    <label class="flex flex-col gap-2">
      <span class="text-sm font-medium text-foreground">
        {t("orchestrationFormWorkflowTemplateName")}
      </span>
      <PlainSelectField
        value={txWorkflow?.workflowTemplateName || ""}
        optionRows={templateOptions}
        onChange={(value) => sourceBindings?.setTemplateName?.(value)}
      />
    </label>
    {#if templateError}
      <p class="text-xs text-destructive">{templateError}</p>
    {/if}
    <JsonObjectFieldsEditor
      title={t("orchestrationFormWorkflowVars")}
      source={txWorkflow?.workflowVars || {}}
      typeRows={visualDisplay?.jsonValueTypeRows || []}
      onChange={(value) => sourceBindings?.setWorkflowVars?.(value)}
    />
  </div>
{:else}
  <div class="flex flex-col gap-2 md:col-span-2">
    <TxJsonFormSurface
      active={true}
      {editorDisplayMode}
      editorKind="inline"
      editorTitle={sourceDisplay.primaryField.labelText}
      editorValue={sourceDisplay.primaryField.valueText}
      formError={txWorkflowFormError}
      hostClass="tx-json-editor tx-json-editor-compact"
      onInlineEditorChange={sourceWorkspace.embeddedJsonChangeHandler("json")}
      onEditorViewSelect={sourceWorkspace.selectEditorView}
      placeholder={sourceDisplay.primaryField.labelText}
    >
      {#snippet formContent()}
        <TxWorkflowVisualEditor
          model={txWorkflowFormModel}
          onChange={sourceWorkspace.embeddedFormChangeHandler("json")}
          embedded={true}
          {settingsOnly}
        />
      {/snippet}
    </TxJsonFormSurface>
  </div>
{/if}

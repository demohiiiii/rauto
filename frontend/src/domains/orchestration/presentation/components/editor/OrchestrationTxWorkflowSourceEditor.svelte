<script lang="ts">
  import JsonObjectFieldsEditor from "$components/fragments/JsonObjectFieldsEditor.svelte";
  import PlainSelectField from "$components/fragments/PlainSelectField.svelte";
  import { t } from "$lib/i18n.js";
  import { createOrchestrationTxWorkflowSourceWorkspace } from "$domains/orchestration/index.js";
  import TxJsonFormSurface from "$domains/transactions/presentation/components/shared/TxJsonFormSurface.svelte";
  import TxWorkflowVisualEditor from "$domains/transactions/presentation/components/workflow/TxWorkflowVisualEditor.svelte";
  import type {
    JsonObject,
    OrchestrationTemplateOption,
    OrchestrationTxWorkflowActionModel,
    OrchestrationTxWorkflowSourceBindings,
    OrchestrationVisualEditorDisplay,
    OrchestrationWorkflowSourceMode,
  } from "$domains/orchestration/index.js";

  interface Props {
    settingsOnly?: boolean;
    sourceBindings: OrchestrationTxWorkflowSourceBindings;
    sourceValue?: "" | OrchestrationWorkflowSourceMode;
    templateError?: string;
    templateOptions?: OrchestrationTemplateOption[];
    txWorkflow: OrchestrationTxWorkflowActionModel;
    visualDisplay: OrchestrationVisualEditorDisplay;
  }

  let {
    sourceValue = "",
    txWorkflow,
    visualDisplay,
    sourceBindings,
    templateOptions = [],
    templateError = "",
    settingsOnly = false,
  }: Props = $props();

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
  let isTemplateSource = $derived(sourceValue === "workflow_template_name");

  $effect(() => {
    sourceWorkspace.setSourceContext({
      sourceBindings,
      sourceValue: "",
      txWorkflow,
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
        onValueChange={(value) => sourceBindings.setTemplateName(value)}
      />
    </label>
    {#if templateError}
      <p class="text-xs text-destructive">{templateError}</p>
    {/if}
    <JsonObjectFieldsEditor
      title={t("orchestrationFormWorkflowVars")}
      source={txWorkflow?.workflowVars || {}}
      typeRows={[...visualDisplay.jsonValueTypeRows]}
      onChange={(value: JsonObject) => sourceBindings.setWorkflowVars(value)}
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
      onInlineEditorChange={sourceWorkspace.embeddedJsonChangeHandler()}
      onEditorInput={undefined}
      onEditorViewSelect={sourceWorkspace.selectEditorView}
      placeholder={sourceDisplay.primaryField.labelText}
    >
      {#snippet formContent()}
        <TxWorkflowVisualEditor
          model={txWorkflowFormModel}
          onChange={sourceWorkspace.embeddedFormChangeHandler()}
          embedded={true}
          onOpenView={undefined}
          {settingsOnly}
        />
      {/snippet}
    </TxJsonFormSurface>
  </div>
{/if}

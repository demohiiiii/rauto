<script>
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import PresenceToggle from "../../components/fragments/PresenceToggle.svelte";
  import { createOrchestrationTxWorkflowSourceWorkspace } from "../../modules/orchestrationEditorState.js";
  import TxJsonFormSurface from "./TxJsonFormSurface.svelte";
  import TxWorkflowVisualEditor from "./TxWorkflowVisualEditor.svelte";

  let {
    sourceValue = "",
    txWorkflow,
    visualDisplay,
    sourceBindings,
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
    sourceWorkspace.primaryFieldChangeHandler(
      sourceDisplay.primaryFieldHandlerKey,
    ),
  );
  let primaryFieldPresenceHandler = $derived(
    sourceWorkspace.fieldPresenceHandler(sourceDisplay.primaryField.fieldKey),
  );
  let primaryFieldNullableModeHandler = $derived(
    sourceWorkspace.fieldNullableModeHandler(
      sourceDisplay.primaryField.fieldKey,
    ),
  );

  $effect(() => {
    sourceWorkspace.setSourceContext({
      sourceBindings,
      sourceValue,
      txWorkflow,
    });
  });
</script>

{#if sourceDisplay.showInputField}
  <div class="md:col-span-2">
    <PresenceFieldGrid
      fieldRows={[sourceDisplay.primaryField]}
      hostClass="contents"
      onValueChange={primaryFieldValueHandler}
      onNullableModeChange={primaryFieldNullableModeHandler}
      onPresenceChange={primaryFieldPresenceHandler}
    />
  </div>
{:else if sourceDisplay.showTextAreaField}
  <div class="flex flex-col gap-2 md:col-span-2">
    <div class="mb-1 flex items-center justify-between gap-3">
      <span class="text-sm font-medium text-foreground">
        {sourceDisplay.primaryField.labelText}
      </span>
      <PresenceToggle
        checked={sourceDisplay.primaryField.enabled}
        onChange={sourceWorkspace.fieldPresenceHandler(
          sourceDisplay.primaryField.fieldKey,
        )}
      />
    </div>
    {#if sourceDisplay.primaryField.enabled}
      <TxJsonFormSurface
        active={true}
        {editorDisplayMode}
        editorKind="inline"
        editorTitle={sourceDisplay.primaryField.labelText}
        editorValue={sourceDisplay.primaryField.valueText}
        formError={txWorkflowFormError}
        hostClass="tx-json-editor tx-json-editor-compact"
        onInlineEditorChange={sourceWorkspace.embeddedJsonChangeHandler(
          sourceDisplay.primaryFieldHandlerKey,
        )}
        onEditorViewSelect={sourceWorkspace.selectEditorView}
        placeholder={sourceDisplay.primaryField.labelText}
      >
        {#snippet formContent()}
          <TxWorkflowVisualEditor
            model={txWorkflowFormModel}
            onChange={sourceWorkspace.embeddedFormChangeHandler(
              sourceDisplay.primaryFieldHandlerKey,
            )}
          />
        {/snippet}
      </TxJsonFormSurface>
    {/if}
  </div>
{/if}

{#if sourceDisplay.showVarsField && sourceDisplay.varsField}
  <div class="md:col-span-2">
    <div class="mb-2 flex items-center justify-between gap-3">
      <span class="text-sm font-medium text-foreground">
        {sourceDisplay.varsField.labelText}
      </span>
      <PresenceToggle
        checked={sourceDisplay.varsField.present}
        onChange={sourceWorkspace.objectPresenceHandler(
          sourceDisplay.varsField.fieldKey,
        )}
      />
    </div>
    {#if sourceDisplay.varsField.present}
      <JsonObjectFieldsEditor
        title={sourceDisplay.varsField.labelText}
        source={sourceDisplay.varsField.source}
        typeRows={visualDisplay.jsonValueTypeRows}
        onChange={sourceWorkspace.workflowVarsHandler()}
      />
    {/if}
  </div>
{/if}

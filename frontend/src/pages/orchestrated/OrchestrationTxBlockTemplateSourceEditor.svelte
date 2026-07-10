<script>
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import PresenceToggle from "../../components/fragments/PresenceToggle.svelte";
  import { createOrchestrationTxBlockTemplateSourceWorkspace } from "../../modules/orchestrationEditorState.js";
  import TxBlockVisualEditor from "./TxBlockVisualEditor.svelte";
  import TxJsonFormSurface from "./TxJsonFormSurface.svelte";

  let {
    sourceValue = "",
    txBlock,
    txBlockRows,
    visualDisplay,
    sourceBindings,
  } = $props();
  const sourceWorkspace = createOrchestrationTxBlockTemplateSourceWorkspace();
  let editorDisplayModeStore = $derived(sourceWorkspace.editorDisplayModeStore);
  let formModelStore = $derived(sourceWorkspace.formModelStore);
  let formErrorStore = $derived(sourceWorkspace.formErrorStore);
  let editorDisplayMode = $derived($editorDisplayModeStore);
  let txBlockFormModel = $derived($formModelStore);
  let txBlockFormError = $derived($formErrorStore);
  let sourceDisplayStateStore = $derived(
    sourceWorkspace.sourceDisplayStateStore,
  );
  let sourceDisplay = $derived($sourceDisplayStateStore);
  let primaryFieldNullableModeHandler = $derived(
    sourceWorkspace.fieldNullableModeHandler(
      sourceDisplay.primaryField.fieldKey,
    ),
  );

  $effect(() => {
    sourceWorkspace.setSourceContext({
      sourceBindings,
      sourceValue,
      txBlock,
      txBlockRows,
    });
  });
</script>

{#if sourceDisplay.showInputField}
  <div class="md:col-span-2">
    <PresenceFieldGrid
      fieldRows={[sourceDisplay.primaryField]}
      hostClass="contents"
      onValueChange={sourceWorkspace.templateNameHandler()}
      onNullableModeChange={primaryFieldNullableModeHandler}
      onPresenceChange={sourceWorkspace.fieldPresenceHandler(
        sourceDisplay.primaryField.fieldKey,
      )}
    />
  </div>
{:else if sourceDisplay.showJsonTextField}
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
        formError={txBlockFormError}
        hostClass="tx-json-editor tx-json-editor-compact"
        onInlineEditorChange={sourceWorkspace.templateContentJsonChangeHandler()}
        onEditorViewSelect={sourceWorkspace.selectEditorView}
        placeholder={sourceDisplay.primaryField.labelText}
      >
        {#snippet formContent()}
          <TxBlockVisualEditor
            model={txBlockFormModel}
            onChange={sourceWorkspace.templateContentFormChangeHandler()}
          />
        {/snippet}
      </TxJsonFormSurface>
    {/if}
  </div>
{/if}

{#if sourceDisplay.showVarsField}
  <div class="flex flex-col gap-2 md:col-span-2">
    <div class="mb-1 flex items-center justify-between gap-3">
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
        onChange={sourceWorkspace.templateVarsHandler()}
      />
    {/if}
  </div>
{/if}

<script>
  import PlainSelectField from "../../components/fragments/PlainSelectField.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import PresenceToggle from "../../components/fragments/PresenceToggle.svelte";
  import { createTxWorkflowTemplateRefSourceWorkspace } from "../../modules/transactionWorkflowEditors.js";
  import TxBlockVisualEditor from "./TxBlockVisualEditor.svelte";
  import TxJsonFormSurface from "./TxJsonFormSurface.svelte";

  let {
    sourceDisplay,
    onSourceFieldPresenceChange,
    onSourceModeChange,
    onTemplateContentChange,
    onTemplateContentModeChange,
    onTemplateNameChange,
    onTemplateNameModeChange,
  } = $props();

  const sourceWorkspace = createTxWorkflowTemplateRefSourceWorkspace({
    onSourceChange: (nextValue) => onTemplateContentChange(nextValue),
  });
  const {
    editorDisplayModeStore,
    formErrorStore,
    formModelStore,
    handleFormChange,
    handleJsonChange,
    selectEditorView,
    setSourceContext,
  } = sourceWorkspace;

  let editorDisplayMode = $derived($editorDisplayModeStore);
  let txBlockFormModel = $derived($formModelStore);
  let txBlockFormError = $derived($formErrorStore);
  let contentValue = $derived(sourceDisplay.sourceField.valueText);
  let showContentEditor = $derived(
    sourceDisplay.sourceField.controlType === "textarea",
  );
  let showContentValueEditor = $derived(
    showContentEditor &&
      sourceDisplay.sourceField.enabled &&
      sourceDisplay.sourceField.nullableModeValue !== "null",
  );

  $effect(() => {
    if (showContentValueEditor) {
      setSourceContext({ sourceValue: contentValue });
    }
  });
</script>

<div class="rounded-xl border border-border bg-muted/20 p-3">
  <div class="grid gap-3">
    <div class="text-xs text-muted-foreground">{sourceDisplay.hintText}</div>
    <div class="max-w-xs">
      <PresenceFieldGrid
        fieldRows={[sourceDisplay.sourceModeField]}
        hostClass="contents"
        onValueChange={onSourceModeChange}
      />
    </div>
    {#if showContentEditor}
      <div class="flex flex-col gap-2">
        <div class="mb-1 flex items-center justify-between gap-3">
          <span class="text-sm font-medium text-foreground">
            {sourceDisplay.sourceField.labelText}
          </span>
          <PresenceToggle
            checked={sourceDisplay.sourceField.enabled}
            onChange={onSourceFieldPresenceChange}
          />
        </div>
        {#if sourceDisplay.sourceField.showNullableModeSelect && sourceDisplay.sourceField.enabled}
          <div class="mb-2 flex justify-end">
            <PlainSelectField
              class="h-8 w-28 text-xs"
              aria-label={sourceDisplay.sourceField.labelText}
              optionRows={sourceDisplay.sourceField.nullableModeRows}
              value={sourceDisplay.sourceField.nullableModeValue}
              onChange={onTemplateContentModeChange}
            />
          </div>
        {/if}
        {#if sourceDisplay.sourceField.enabled}
          {#if showContentValueEditor}
            <TxJsonFormSurface
              active={true}
              {editorDisplayMode}
              editorKind="inline"
              editorTitle={sourceDisplay.sourceField.labelText}
              editorValue={contentValue}
              formError={txBlockFormError}
              hostClass="tx-json-editor tx-json-editor-compact"
              onInlineEditorChange={handleJsonChange}
              onEditorViewSelect={selectEditorView}
              placeholder={sourceDisplay.sourceField.labelText}
            >
              {#snippet formContent()}
                <TxBlockVisualEditor
                  model={txBlockFormModel}
                  onChange={handleFormChange}
                />
              {/snippet}
            </TxJsonFormSurface>
          {/if}
        {/if}
      </div>
    {:else}
      <PresenceFieldGrid
        fieldRows={[sourceDisplay.sourceField]}
        hostClass="contents"
        onValueChange={onTemplateNameChange}
        onNullableModeChange={onTemplateNameModeChange}
        onPresenceChange={onSourceFieldPresenceChange}
      />
    {/if}
  </div>
</div>

<script>
  import OrchestrationPlanFormEditor from "./OrchestrationPlanFormEditor.svelte";
  import { TX_EDITOR } from "../../modules/transactionsWorkspace.js";
  import TxJsonFormSurface from "./TxJsonFormSurface.svelte";

  let {
    active,
    editorDisplayMode,
    editorDisplay,
    editorValue,
    orchestrationFormError,
    orchestrationFormModel,
    visualDisplay,
    onEditorViewSelect,
    onFormChange,
    onEditorErrorChange,
    onEditorInput,
  } = $props();
</script>

<div class="grid gap-3">
  <TxJsonFormSurface
    {active}
    {editorDisplayMode}
    editorKey={TX_EDITOR.orchestration}
    {editorValue}
    editorTitle={editorDisplay.editorTitle}
    formError={orchestrationFormError}
    hostClass="tx-json-editor tx-json-editor-compact"
    jsonHintText={editorDisplay.jsonHint}
    {onEditorInput}
    {onEditorViewSelect}
    placeholder={editorDisplay.placeholderText}
  >
    {#snippet formContent()}
      <OrchestrationPlanFormEditor
        model={orchestrationFormModel}
        {visualDisplay}
        onChange={onFormChange}
        onErrorChange={onEditorErrorChange}
      />
    {/snippet}
  </TxJsonFormSurface>
</div>

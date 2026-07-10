<script>
  import * as Card from "$lib/components/ui/card";
  import FilePickerButton from "../../components/fragments/FilePickerButton.svelte";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import {
    createOrchestrationEditorPanelWorkspace,
    orchestrationJsonPlaceholder,
  } from "../../modules/orchestrationWorkspace.js";
  import OrchestrationEditorSurface from "./OrchestrationEditorSurface.svelte";

  let {
    active,
    onCreateDraft,
    onEditorInput,
    onExecute,
    onImportFile,
    onPreview,
    orchestrationEditorRunButtonDisplay,
    editorSyncVersion = 0,
  } = $props();

  const orchestrationEditorWorkspace =
    createOrchestrationEditorPanelWorkspace();
  const {
    changeFormModel,
    createJsonDraft,
    editorDisplayStateStore,
    editorDisplayModeStateStore,
    ensureInitialized,
    formErrorStateStore,
    formModelStateStore,
    handleEditorJsonInput,
    importFile,
    jsonTextStateStore,
    selectEditorView,
    setEditorPanelContext,
    setFormError,
    visualDisplayStateStore,
  } = orchestrationEditorWorkspace;
  let editorDisplay = $derived($editorDisplayStateStore);
  let editorDisplayMode = $derived($editorDisplayModeStateStore);
  let orchestrationFormModel = $derived($formModelStateStore);
  let orchestrationFormError = $derived($formErrorStateStore);
  let orchestrationJsonText = $derived($jsonTextStateStore);
  let visualDisplay = $derived($visualDisplayStateStore);

  $effect(() => {
    setEditorPanelContext({
      editorSyncVersion,
      jsonPlaceholder: orchestrationJsonPlaceholder,
      onCreateDraft,
      onEditorInput,
      onImportFile,
    });
    ensureInitialized();
  });
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>{editorDisplay.editorTitle}</Card.Title>
    <Card.Action>
      <div class="inline-flex flex-wrap items-center gap-2">
        <LoadingButton
          variant="outline"
          size="sm"
          loading={orchestrationEditorRunButtonDisplay.createLoading}
          onclick={createJsonDraft}
        >
          <span>{editorDisplay.newButtonLabel}</span>
        </LoadingButton>
        <FilePickerButton
          variant="outline"
          size="sm"
          accept=".json,application/json"
          onFile={importFile}
        >
          {editorDisplay.importButtonLabel}
        </FilePickerButton>
      </div>
    </Card.Action>
  </Card.Header>
  <Card.Content>
    <OrchestrationEditorSurface
      {active}
      {editorDisplayMode}
      {editorDisplay}
      editorValue={orchestrationJsonText}
      {orchestrationFormError}
      {orchestrationFormModel}
      {visualDisplay}
      onEditorViewSelect={selectEditorView}
      onFormChange={changeFormModel}
      onEditorErrorChange={setFormError}
      onEditorInput={handleEditorJsonInput}
    />
  </Card.Content>
</Card.Root>
<div class="grid grid-cols-2 gap-2">
  <LoadingButton
    variant="outline"
    size="sm"
    loading={orchestrationEditorRunButtonDisplay.previewLoading}
    onclick={onPreview}
  >
    <span>{editorDisplay.planButtonLabel}</span>
  </LoadingButton>
  <LoadingButton
    variant="default"
    size="sm"
    loading={orchestrationEditorRunButtonDisplay.executeLoading}
    onclick={onExecute}
  >
    <span>{editorDisplay.executeButtonLabel}</span>
  </LoadingButton>
</div>

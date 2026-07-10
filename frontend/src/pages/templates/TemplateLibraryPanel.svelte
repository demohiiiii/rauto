<script>
  import CollapsibleGroup from "../../components/fragments/CollapsibleGroup.svelte";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import PlainTextAreaField from "../../components/fragments/PlainTextAreaField.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import { createTemplateLibraryPanelWorkspace } from "../../modules/templates.js";
  import TemplateResourcePickerPanel from "./TemplateResourcePickerPanel.svelte";

  let { onCreateDraft, onDelete, onPickerChange, onSave, onSelect } = $props();
  function handleCreateDraft(...args) {
    if (typeof onCreateDraft === "function") {
      return onCreateDraft(...args);
    }
  }
  function handleDelete(...args) {
    if (typeof onDelete === "function") {
      return onDelete(...args);
    }
  }
  function handlePickerChange(...args) {
    if (typeof onPickerChange === "function") {
      return onPickerChange(...args);
    }
  }
  function handleSave(...args) {
    if (typeof onSave === "function") {
      return onSave(...args);
    }
  }
  function handleSelect(...args) {
    if (typeof onSelect === "function") {
      return onSelect(...args);
    }
  }

  const templateLibraryPanelWorkspace = createTemplateLibraryPanelWorkspace({
    onCreateDraft: handleCreateDraft,
    onDelete: handleDelete,
    onPickerChange: handlePickerChange,
    onSave: handleSave,
    onSelect: handleSelect,
  });
  const { loadingStateStore } = templateLibraryPanelWorkspace;
  let templateLibraryLoadingState = $derived($loadingStateStore);
  const {
    contentFieldStateStore,
    headerDisplayStateStore,
    pickerDisplayStateStore,
    statusDisplayStateStore,
  } = templateLibraryPanelWorkspace;
  let deleteLoading = $derived(templateLibraryLoadingState.deleteLoading);
  let newLoading = $derived(templateLibraryLoadingState.newLoading);
  let saveLoading = $derived(templateLibraryLoadingState.saveLoading);
  let contentFieldDisplay = $derived($contentFieldStateStore);
  let headerDisplay = $derived($headerDisplayStateStore);
  let pickerDisplay = $derived($pickerDisplayStateStore);
  let statusDisplay = $derived($statusDisplayStateStore);
</script>

<div class="grid gap-3">
  <CollapsibleGroup persistenceKey="template-picker-body">
    {#snippet header()}
      <span class="text-sm font-semibold text-slate-700">
        {headerDisplay.listTitle}
      </span>
    {/snippet}

    <TemplateResourcePickerPanel
      {deleteLoading}
      onDelete={templateLibraryPanelWorkspace.deleteTemplate}
      onPickerChange={templateLibraryPanelWorkspace.changePicker}
      onSave={templateLibraryPanelWorkspace.saveTemplate}
      onSelect={templateLibraryPanelWorkspace.selectTemplate}
      {pickerDisplay}
      {saveLoading}
    />
  </CollapsibleGroup>
  <CollapsibleGroup persistenceKey="template-editor-body">
    {#snippet header()}
      <span class="text-sm font-semibold text-slate-700">
        {headerDisplay.editorTitle}
      </span>
      <LoadingButton
        variant="outline"
        size="sm"
        loading={newLoading}
        onclick={templateLibraryPanelWorkspace.createDraft}
      >
        <span>{headerDisplay.newButtonLabel}</span>
      </LoadingButton>
    {/snippet}

    <PlainTextAreaField
      class="min-h-64 font-mono"
      placeholderText={contentFieldDisplay.placeholderText}
      aria-label={contentFieldDisplay.ariaLabel}
      value={contentFieldDisplay.value}
      onValueInput={templateLibraryPanelWorkspace.changeContent}
    />
  </CollapsibleGroup>
  {#if statusDisplay.show}
    <div class="grid gap-2">
      <StatusCard
        message={statusDisplay.message}
        tone={statusDisplay.tone}
        variant="alert"
      />
    </div>
  {/if}
</div>

<script>
  import * as Card from "$lib/components/ui/card";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import PlainTextAreaField from "../../components/fragments/PlainTextAreaField.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import { createTextfsmTemplateEditorPanelWorkspace } from "../../modules/templates.js";
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

  const textfsmTemplatePanelWorkspace =
    createTextfsmTemplateEditorPanelWorkspace({
      onCreateDraft: handleCreateDraft,
      onDelete: handleDelete,
      onPickerChange: handlePickerChange,
      onSave: handleSave,
      onSelect: handleSelect,
    });
  const { loadingStateStore } = textfsmTemplatePanelWorkspace;
  let textfsmTemplateLoadingState = $derived($loadingStateStore);
  const {
    contentFieldStateStore,
    headerDisplayStateStore,
    pickerDisplayStateStore,
    statusDisplayStateStore,
  } = textfsmTemplatePanelWorkspace;
  let deleteLoading = $derived(textfsmTemplateLoadingState.deleteLoading);
  let newLoading = $derived(textfsmTemplateLoadingState.newLoading);
  let saveLoading = $derived(textfsmTemplateLoadingState.saveLoading);
  let contentFieldDisplay = $derived($contentFieldStateStore);
  let headerDisplay = $derived($headerDisplayStateStore);
  let pickerDisplay = $derived($pickerDisplayStateStore);
  let statusDisplay = $derived($statusDisplayStateStore);
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>
      {headerDisplay.title}
    </Card.Title>
    <Card.Action>
      <LoadingButton
        variant="outline"
        size="sm"
        loading={newLoading}
        onclick={textfsmTemplatePanelWorkspace.createDraft}
      >
        <span>{headerDisplay.newButtonLabel}</span>
      </LoadingButton>
    </Card.Action>
  </Card.Header>
  <Card.Content class="grid gap-3">
    <TemplateResourcePickerPanel
      {deleteLoading}
      onDelete={textfsmTemplatePanelWorkspace.deleteTemplate}
      onPickerChange={textfsmTemplatePanelWorkspace.changePicker}
      onSave={textfsmTemplatePanelWorkspace.saveTemplate}
      onSelect={textfsmTemplatePanelWorkspace.selectTemplate}
      {pickerDisplay}
      {saveLoading}
    />
    <PlainTextAreaField
      class="min-h-80 font-mono"
      placeholderText={contentFieldDisplay.placeholderText}
      aria-label={contentFieldDisplay.ariaLabel}
      value={contentFieldDisplay.value}
      onValueInput={textfsmTemplatePanelWorkspace.changeContent}
    />
    {#if statusDisplay.show}
      <div class="grid gap-2">
        <StatusCard
          message={statusDisplay.message}
          tone={statusDisplay.tone}
          variant="alert"
        />
      </div>
    {/if}
  </Card.Content>
</Card.Root>

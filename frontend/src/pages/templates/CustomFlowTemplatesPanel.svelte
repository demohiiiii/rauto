<script>
  import * as Card from "$lib/components/ui/card";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import PlainTextAreaField from "../../components/fragments/PlainTextAreaField.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import { createCustomFlowTemplatePanelWorkspace } from "../../modules/templates.js";
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

  const customFlowTemplatePanelWorkspace =
    createCustomFlowTemplatePanelWorkspace({
      onCreateDraft: handleCreateDraft,
      onDelete: handleDelete,
      onPickerChange: handlePickerChange,
      onSave: handleSave,
      onSelect: handleSelect,
    });
  const { loadingStateStore } = customFlowTemplatePanelWorkspace;
  let customFlowTemplateLoadingState = $derived($loadingStateStore);
  const {
    contentFieldStateStore,
    headerDisplayStateStore,
    pickerDisplayStateStore,
    statusDisplayStateStore,
  } = customFlowTemplatePanelWorkspace;
  let deleteLoading = $derived(customFlowTemplateLoadingState.deleteLoading);
  let newLoading = $derived(customFlowTemplateLoadingState.newLoading);
  let saveLoading = $derived(customFlowTemplateLoadingState.saveLoading);
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
  </Card.Header>
  <Card.Content class="grid gap-3">
    <div class="text-xs text-slate-500">
      {headerDisplay.hintText}
    </div>
    <TemplateResourcePickerPanel
      {deleteLoading}
      onDelete={customFlowTemplatePanelWorkspace.deleteTemplate}
      onPickerChange={customFlowTemplatePanelWorkspace.changePicker}
      onSave={customFlowTemplatePanelWorkspace.saveTemplate}
      onSelect={customFlowTemplatePanelWorkspace.selectTemplate}
      {pickerDisplay}
      {saveLoading}
    />
    <div class="flex justify-end">
      <LoadingButton
        variant="outline"
        size="sm"
        loading={newLoading}
        onclick={customFlowTemplatePanelWorkspace.createDraft}
      >
        <span>{headerDisplay.newButtonLabel}</span>
      </LoadingButton>
    </div>
    <PlainTextAreaField
      class="min-h-64 font-mono"
      placeholderText={contentFieldDisplay.placeholderText}
      aria-label={contentFieldDisplay.ariaLabel}
      value={contentFieldDisplay.value}
      onValueInput={customFlowTemplatePanelWorkspace.changeContent}
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

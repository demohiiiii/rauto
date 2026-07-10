<script>
  import { callbackHandler } from "../../lib/events.js";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import PlainSelectField from "../../components/fragments/PlainSelectField.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import { createTemplateResourcePickerPanelWorkspace } from "../../modules/templates.js";

  let {
    deleteLoading,
    onDelete,
    onPickerChange,
    onSave,
    onSelect,
    pickerDisplay,
    saveLoading,
  } = $props();
  function forwardPickerChange(...args) {
    if (typeof onPickerChange === "function") {
      return onPickerChange(...args);
    }
  }
  function forwardSelect(...args) {
    if (typeof onSelect === "function") {
      return onSelect(...args);
    }
  }
  const templateResourcePickerPanelWorkspace =
    createTemplateResourcePickerPanelWorkspace({
      onPickerChange: forwardPickerChange,
      onSelect: forwardSelect,
    });
</script>

<div class={pickerDisplay.rootClass}>
  <div class="grid gap-2 md:grid-cols-[1fr_auto_auto]">
    <PlainSelectField
      title={pickerDisplay.selectPlaceholder}
      aria-label={pickerDisplay.selectPlaceholder}
      value={pickerDisplay.selectedName}
      optionRows={pickerDisplay.selectOptionRows}
      onValueChange={templateResourcePickerPanelWorkspace.changePicker}
    />
    <LoadingButton
      variant="default"
      size="sm"
      loading={saveLoading}
      onclick={onSave}
    >
      <span>{pickerDisplay.saveLabel}</span>
    </LoadingButton>
    <LoadingButton
      variant="destructive"
      size="sm"
      loading={deleteLoading}
      onclick={onDelete}
    >
      <span>{pickerDisplay.deleteLabel}</span>
    </LoadingButton>
  </div>

  <div class="grid gap-2">
    {#if !pickerDisplay.hasItems}
      <StatusCard
        message={pickerDisplay.emptyStatus.message}
        tone={pickerDisplay.emptyStatus.tone}
      />
    {:else}
      {#each pickerDisplay.resourceItems as resourceItem}
        <button
          type="button"
          class={resourceItem.itemClass}
          onclick={callbackHandler(
            templateResourcePickerPanelWorkspace.selectItem,
            resourceItem.name,
          )}
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-sm font-semibold text-slate-800">
              {resourceItem.nameText}
            </span>
            <span class={resourceItem.badgeClass}>
              {resourceItem.badgeText}
            </span>
          </div>
        </button>
      {/each}
    {/if}
  </div>
</div>

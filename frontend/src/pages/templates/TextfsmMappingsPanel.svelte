<script>
  import * as Card from "$lib/components/ui/card";
  import { callbackHandler } from "../../lib/events.js";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import PlainSelectField from "../../components/fragments/PlainSelectField.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import { createTextfsmMappingsPanelWorkspace } from "../../modules/templates.js";

  let { onDelete, onLoad, onProfileChange, onSave, onSelect } = $props();
  function handleDelete(...args) {
    if (typeof onDelete === "function") {
      return onDelete(...args);
    }
  }
  function handleLoad(...args) {
    if (typeof onLoad === "function") {
      return onLoad(...args);
    }
  }
  function forwardProfileChange(...args) {
    if (typeof onProfileChange === "function") {
      return onProfileChange(...args);
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

  const textfsmMappingsPanelWorkspace = createTextfsmMappingsPanelWorkspace({
    onDelete: handleDelete,
    onLoad: handleLoad,
    onProfileChange: forwardProfileChange,
    onSave: handleSave,
    onSelect: handleSelect,
  });
  const { loadingStateStore } = textfsmMappingsPanelWorkspace;
  let textfsmMappingLoadingState = $derived($loadingStateStore);
  const {
    formSectionDisplayStateStore,
    headerDisplayStateStore,
    listDisplayStateStore,
    statusDisplayStateStore,
  } = textfsmMappingsPanelWorkspace;
  let textfsmMappingRefreshLoading = $derived(
    textfsmMappingLoadingState.refreshLoading,
  );
  let textfsmMappingSaveLoading = $derived(
    textfsmMappingLoadingState.saveLoading,
  );
  let textfsmMappingDeleteLoading = $derived(
    textfsmMappingLoadingState.deleteLoading,
  );
  let headerDisplay = $derived($headerDisplayStateStore);
  let formSectionDisplay = $derived($formSectionDisplayStateStore);
  let listDisplay = $derived($listDisplayStateStore);
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
        loading={textfsmMappingRefreshLoading}
        onclick={textfsmMappingsPanelWorkspace.loadTextfsmMappings}
      >
        <span>{headerDisplay.refreshButtonLabel}</span>
      </LoadingButton>
    </Card.Action>
  </Card.Header>
  <Card.Content class="grid gap-3">
    <div class="grid gap-3">
      <PlainSelectField
        title={formSectionDisplay.profileField.placeholder}
        aria-label={formSectionDisplay.profileField.placeholder}
        value={formSectionDisplay.profileField.currentValue}
        optionRows={formSectionDisplay.profileField.options}
        onValueChange={textfsmMappingsPanelWorkspace.changeProfile}
      />
      <PlainInputField
        class="font-mono"
        placeholderText={formSectionDisplay.commandField.placeholder}
        aria-label={formSectionDisplay.commandField.placeholder}
        value={formSectionDisplay.commandField.currentValue}
        onValueInput={textfsmMappingsPanelWorkspace.changeCommand}
      />
      <PlainSelectField
        title={formSectionDisplay.templateField.placeholder}
        aria-label={formSectionDisplay.templateField.placeholder}
        value={formSectionDisplay.templateField.currentValue}
        optionRows={formSectionDisplay.templateField.options}
        onValueChange={textfsmMappingsPanelWorkspace.changeTemplate}
      />
      <div class="grid gap-2 sm:grid-cols-2">
        <LoadingButton
          variant="default"
          size="sm"
          loading={textfsmMappingSaveLoading}
          onclick={textfsmMappingsPanelWorkspace.saveTextfsmMapping}
        >
          <span>{formSectionDisplay.saveButtonLabel}</span>
        </LoadingButton>
        <LoadingButton
          variant="destructive"
          size="sm"
          loading={textfsmMappingDeleteLoading}
          onclick={textfsmMappingsPanelWorkspace.deleteTextfsmMapping}
        >
          <span>{formSectionDisplay.deleteButtonLabel}</span>
        </LoadingButton>
      </div>
      <div class="text-xs leading-relaxed text-slate-500">
        {formSectionDisplay.hintText}
      </div>
    </div>

    <div class="grid gap-2">
      {#if !listDisplay.hasItems}
        <StatusCard
          message={listDisplay.emptyStatus.message}
          tone={listDisplay.emptyStatus.tone}
        />
      {:else}
        {#each listDisplay.textfsmMappingRows as textfsmMappingRow}
          <button
            type="button"
            class={textfsmMappingRow.itemClass}
            onclick={callbackHandler(
              textfsmMappingsPanelWorkspace.selectItem,
              textfsmMappingRow.mapping,
            )}
          >
            <div class="grid gap-1">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-sm font-semibold text-slate-800">
                  {textfsmMappingRow.profileText}
                </span>
                <span class={textfsmMappingRow.templateBadgeClass}>
                  {textfsmMappingRow.templateNameText}
                </span>
              </div>
              <div class="break-all font-mono text-xs text-slate-600">
                {textfsmMappingRow.commandText}
              </div>
            </div>
          </button>
        {/each}
      {/if}
      {#if statusDisplay.show}
        <StatusCard
          message={statusDisplay.message}
          tone={statusDisplay.tone}
          variant="alert"
        />
      {/if}
    </div>
  </Card.Content>
</Card.Root>

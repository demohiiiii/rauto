<script>
  import * as Card from "$lib/components/ui/card";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import { createCustomShowObjectsPanelWorkspace } from "../../modules/templates.js";
  import CustomShowObjectEditorPanel from "./CustomShowObjectEditorPanel.svelte";
  import CustomShowObjectListPanel from "./CustomShowObjectListPanel.svelte";
  let {
    onCommandInput,
    onDelete,
    onMappingChange,
    onProfileChange,
    onRefresh,
    onSave,
    onSelect,
    onUseMappingChange,
  } = $props();
  function handleCommandInput(...args) {
    if (typeof onCommandInput === "function") {
      return onCommandInput(...args);
    }
  }
  function handleDelete(...args) {
    if (typeof onDelete === "function") {
      return onDelete(...args);
    }
  }
  function handleMappingChange(...args) {
    if (typeof onMappingChange === "function") {
      return onMappingChange(...args);
    }
  }
  function handleProfileChange(...args) {
    if (typeof onProfileChange === "function") {
      return onProfileChange(...args);
    }
  }
  function handleRefresh(...args) {
    if (typeof onRefresh === "function") {
      return onRefresh(...args);
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
  function handleUseMappingChange(...args) {
    if (typeof onUseMappingChange === "function") {
      return onUseMappingChange(...args);
    }
  }
  const customShowObjectsPanelWorkspace = createCustomShowObjectsPanelWorkspace(
    {
      onCommandInput: handleCommandInput,
      onDelete: handleDelete,
      onMappingChange: handleMappingChange,
      onProfileChange: handleProfileChange,
      onRefresh: handleRefresh,
      onSave: handleSave,
      onSelect: handleSelect,
      onUseMappingChange: handleUseMappingChange,
    },
  );
  const { loadingStateStore } = customShowObjectsPanelWorkspace;
  let customShowObjectLoadingState = $derived($loadingStateStore);
  const {
    basicFieldsDisplayStateStore,
    buttonDisplayStateStore,
    commandSectionDisplayStateStore,
    headerDisplayStateStore,
    listSectionDisplayStateStore,
  } = customShowObjectsPanelWorkspace;
  let refreshLoading = $derived(customShowObjectLoadingState.refreshLoading);
  let deleteLoading = $derived(customShowObjectLoadingState.deleteLoading);
  let saveLoading = $derived(customShowObjectLoadingState.saveLoading);
  let basicFieldsDisplay = $derived($basicFieldsDisplayStateStore);
  let buttonDisplay = $derived($buttonDisplayStateStore);
  let commandSectionDisplay = $derived($commandSectionDisplayStateStore);
  let headerDisplay = $derived($headerDisplayStateStore);
  let listSectionDisplay = $derived($listSectionDisplayStateStore);
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
        loading={refreshLoading}
        onclick={customShowObjectsPanelWorkspace.refreshCustomShowObjects}
      >
        <span>{headerDisplay.refreshButtonLabel}</span>
      </LoadingButton>
    </Card.Action>
  </Card.Header>
  <Card.Content class="grid gap-3">
    <CustomShowObjectEditorPanel
      {basicFieldsDisplay}
      {buttonDisplay}
      {commandSectionDisplay}
      {deleteLoading}
      onCommandChange={customShowObjectsPanelWorkspace.changeCommand}
      onDeleteAction={customShowObjectsPanelWorkspace.deleteCustomShowObject}
      onEnabledChange={customShowObjectsPanelWorkspace.changeEnabled}
      onMappingChange={customShowObjectsPanelWorkspace.changeMapping}
      onModeChange={customShowObjectsPanelWorkspace.changeMode}
      onObjectChange={customShowObjectsPanelWorkspace.changeObject}
      onProfileChange={customShowObjectsPanelWorkspace.changeProfile}
      onSaveAction={customShowObjectsPanelWorkspace.saveCustomShowObject}
      onTemplateChange={customShowObjectsPanelWorkspace.changeTemplate}
      onUseMappingChange={customShowObjectsPanelWorkspace.changeUseMapping}
      {saveLoading}
    />

    <CustomShowObjectListPanel
      {listSectionDisplay}
      onSelectItem={customShowObjectsPanelWorkspace.selectItem}
    />
  </Card.Content>
</Card.Root>

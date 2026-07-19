<script>
  import DashboardTabPanel from "../components/layout/DashboardTabPanel.svelte";
  import TabList from "../components/fragments/TabList.svelte";
  import { inventorySectionTabs } from "../config/dashboardModes.js";
  import { createInventoryPageWorkspace } from "../modules/inventory/inventoryPageWorkspace.js";
  import InventoryCollectionPanel from "./inventory/InventoryCollectionPanel.svelte";

  let { active } = $props();
  const inventoryPageWorkspace = createInventoryPageWorkspace();
  const {
    clearGroupHosts,
    clearLabelHosts,
    createInventoryGroupDraft,
    createInventoryLabelDraft,
    deleteInventoryGroupSelection,
    deleteInventoryLabelSelection,
    currentInventorySectionState,
    destroy,
    openInventorySection,
    pageDisplayStateStore,
    saveInventoryGroupSelection,
    saveInventoryLabelSelection,
    selectAllGroupHosts,
    selectAllLabelHosts,
    selectInventoryGroupName,
    selectInventoryLabelName,
    setPageContext,
    updateGroupHostFilter,
    updateGroupHostSelection,
    updateInventoryGroupDescription,
    updateLabelHostFilter,
    updateLabelHostSelection,
  } = inventoryPageWorkspace;
  let currentInventorySection = $derived($currentInventorySectionState);
  let pageDisplay = $derived($pageDisplayStateStore);
  let groupsPanelProps = $derived({
    onClearHosts: clearGroupHosts,
    onCreateDraft: createInventoryGroupDraft,
    onDelete: deleteInventoryGroupSelection,
    onDescriptionInput: updateInventoryGroupDescription,
    onHostFilter: updateGroupHostFilter,
    onHostSelection: updateGroupHostSelection,
    onSave: saveInventoryGroupSelection,
    onSelectAllHosts: selectAllGroupHosts,
    onSelectCollection: selectInventoryGroupName,
  });
  let labelsPanelProps = $derived({
    onClearHosts: clearLabelHosts,
    onCreateDraft: createInventoryLabelDraft,
    onDelete: deleteInventoryLabelSelection,
    onHostFilter: updateLabelHostFilter,
    onHostSelection: updateLabelHostSelection,
    onSave: saveInventoryLabelSelection,
    onSelectAllHosts: selectAllLabelHosts,
    onSelectCollection: selectInventoryLabelName,
  });

  $effect(() => {
    setPageContext({ active });
  });

  $effect(() => {
    return () => {
      destroy();
    };
  });
</script>

<DashboardTabPanel {active}>
  <TabList
    tabItems={inventorySectionTabs}
    activeValue={currentInventorySection}
    aria-label={pageDisplay.sectionAriaLabel}
    class="w-fit"
    onSelect={openInventorySection}
  />

  <InventoryCollectionPanel
    collectionDisplay={pageDisplay.groups}
    {...groupsPanelProps}
  />

  <InventoryCollectionPanel
    collectionDisplay={pageDisplay.labels}
    {...labelsPanelProps}
  />
</DashboardTabPanel>

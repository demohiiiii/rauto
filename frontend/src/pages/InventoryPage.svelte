<script>
  import * as Card from "$lib/components/ui/card";
  import * as Tabs from "$lib/components/ui/tabs";
  import ListTreeIcon from "@lucide/svelte/icons/list-tree";
  import NetworkIcon from "@lucide/svelte/icons/network";
  import TagIcon from "@lucide/svelte/icons/tag";
  import DashboardTabPanel from "../components/layout/DashboardTabPanel.svelte";
  import WorkspaceActionHeader from "../components/fragments/WorkspaceActionHeader.svelte";
  import { INVENTORY_KIND } from "../config/dashboardModes.js";
  import { currentLanguageState, t } from "../lib/i18n.js";
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
  let currentLanguage = $derived($currentLanguageState);
  let currentInventorySection = $derived($currentInventorySectionState);
  let pageDisplay = $derived($pageDisplayStateStore);
  let pageLabels = $derived.by(() => {
    currentLanguage;
    return {
      title: t("inventoryTitle"),
      description: t("inventoryWorkspaceDescription"),
      groups: t("inventoryGroupsTitle"),
      labels: t("inventoryLabelsTitle"),
      catalogStatus: t("inventoryWorkspaceStatus"),
    };
  });
  let activeSectionLabel = $derived(
    currentInventorySection === INVENTORY_KIND.labels
      ? pageLabels.labels
      : pageLabels.groups,
  );
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
  <Card.Root
    class="gap-0 overflow-hidden border-border/80 py-0 shadow-sm"
    aria-labelledby="inventory-page-title"
  >
    <WorkspaceActionHeader
      title={pageLabels.title}
      titleId="inventory-page-title"
      description={pageLabels.description}
      icon={NetworkIcon}
    />

    <div
      class="grid border-b bg-muted/10 sm:grid-cols-3 sm:divide-x sm:divide-border"
    >
      <div class="flex items-center gap-3 px-4 py-3 sm:px-5">
        <ListTreeIcon
          class="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <div class="min-w-0">
          <div class="text-xs text-muted-foreground">{pageLabels.groups}</div>
          <div class="font-mono text-base font-semibold tabular-nums">
            {pageDisplay.groups.listDisplay.collectionCount}
          </div>
        </div>
      </div>
      <div class="flex items-center gap-3 px-4 py-3 sm:px-5">
        <TagIcon
          class="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <div class="min-w-0">
          <div class="text-xs text-muted-foreground">{pageLabels.labels}</div>
          <div class="font-mono text-base font-semibold tabular-nums">
            {pageDisplay.labels.listDisplay.collectionCount}
          </div>
        </div>
      </div>
      <div class="flex items-center gap-3 px-4 py-3 sm:px-5">
        <NetworkIcon class="size-4 shrink-0 text-primary" aria-hidden="true" />
        <div class="min-w-0">
          <div class="text-xs text-muted-foreground">
            {pageLabels.catalogStatus}
          </div>
          <div class="truncate text-sm font-semibold">
            {activeSectionLabel}
          </div>
        </div>
      </div>
    </div>

    <Tabs.Root
      value={currentInventorySection}
      onValueChange={openInventorySection}
      class="min-w-0 gap-0"
    >
      <div class="border-b bg-muted/15 px-3 py-2 sm:px-5">
        <Tabs.List
          variant="line"
          aria-label={pageDisplay.sectionAriaLabel}
          class="!grid !h-auto w-full grid-cols-2 gap-1 sm:w-fit sm:min-w-72"
        >
          <Tabs.Trigger
            value={INVENTORY_KIND.groups}
            class="h-10 min-w-0 rounded-lg px-3 data-active:!text-primary"
          >
            <ListTreeIcon data-icon="inline-start" aria-hidden="true" />
            <span>{pageLabels.groups}</span>
          </Tabs.Trigger>
          <Tabs.Trigger
            value={INVENTORY_KIND.labels}
            class="h-10 min-w-0 rounded-lg px-3 data-active:!text-primary"
          >
            <TagIcon data-icon="inline-start" aria-hidden="true" />
            <span>{pageLabels.labels}</span>
          </Tabs.Trigger>
        </Tabs.List>
      </div>

      <div class="min-w-0 p-4 sm:p-5 lg:p-6">
        <InventoryCollectionPanel
          collectionDisplay={pageDisplay.groups}
          {...groupsPanelProps}
        />

        <InventoryCollectionPanel
          collectionDisplay={pageDisplay.labels}
          {...labelsPanelProps}
        />
      </div>
    </Tabs.Root>
  </Card.Root>
</DashboardTabPanel>

<script lang="ts">
  import DashboardDrawerShell from "./DashboardDrawerShell.svelte";
  import HistoryDrawerContent from "./HistoryDrawerContent.svelte";
  import { createHistoryDrawerWorkspace } from "$domains/connections/index.js";
  import {
    closeRecordDrawer,
    createRecordDrawerWorkspace,
  } from "$domains/overlays/index.js";

  const recordDrawerWorkspace = createRecordDrawerWorkspace();
  const historyDrawerWorkspace = createHistoryDrawerWorkspace();
  const {
    changeDevice,
    changeLimit,
    changeOperation,
    changeQuery,
    clearFilters,
    deleteHistoryItem,
    historyDisplayStateStore,
    openHistoryItem,
    openHistory,
    replayHistoryItem,
    refreshHistory,
  } = historyDrawerWorkspace;
  let drawerShellDisplayStateStore = $derived(
    recordDrawerWorkspace.drawerShellDisplayStateStore,
  );
  let drawerShellDisplay = $derived($drawerShellDisplayStateStore);
  let historyDisplay = $derived($historyDisplayStateStore);
  let wasOpen = false;

  $effect(() => {
    const open = drawerShellDisplay.open;
    if (open && !wasOpen) void openHistory();
    wasOpen = open;
  });
</script>

<DashboardDrawerShell
  {drawerShellDisplay}
  onClose={closeRecordDrawer}
  class="data-[side=right]:w-[min(100vw,64rem)] data-[side=right]:sm:max-w-3xl data-[side=right]:xl:max-w-4xl"
>
  <HistoryDrawerContent
    {historyDisplay}
    onDeviceChange={changeDevice}
    onDeleteItem={deleteHistoryItem}
    onLimitChange={changeLimit}
    onOpenItem={openHistoryItem}
    onReplayItem={replayHistoryItem}
    onOperationChange={changeOperation}
    onQueryInput={changeQuery}
    onClearFilters={clearFilters}
    onRefresh={refreshHistory}
  />
</DashboardDrawerShell>

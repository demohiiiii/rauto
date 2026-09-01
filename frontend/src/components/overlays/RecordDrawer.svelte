<script>
  import * as Tabs from "$lib/components/ui/tabs/index.js";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import VideoIcon from "@lucide/svelte/icons/video";
  import DashboardDrawerShell from "./DashboardDrawerShell.svelte";
  import HistoryDrawerContent from "./HistoryDrawerContent.svelte";
  import RecordDrawerContent from "./RecordDrawerContent.svelte";
  import { createHistoryDrawerWorkspace } from "../../modules/connections/connections.js";
  import {
    SESSION_RECORDS_VIEW,
    closeRecordDrawer,
    createRecordDrawerWorkspace,
    recordDrawerRecordingState,
    sessionRecordsViewState,
    setSessionRecordsView,
  } from "$domains/overlays/index.js";

  const recordDrawerWorkspace = createRecordDrawerWorkspace();
  const historyDrawerWorkspace = createHistoryDrawerWorkspace();
  const {
    changeLimit,
    changeOperation,
    changeQuery,
    clearFilters,
    deleteHistoryItem,
    historyDisplayStateStore,
    openHistoryItem,
    refreshHistory,
  } = historyDrawerWorkspace;
  let drawerShellDisplayStateStore = $derived(
    recordDrawerWorkspace.drawerShellDisplayStateStore,
  );
  let contentDisplayStateStore = $derived(
    recordDrawerWorkspace.contentDisplayStateStore,
  );
  let drawerContentDisplayStateStore = $derived(
    recordDrawerWorkspace.drawerContentDisplayStateStore,
  );
  let openEntryIndexHandlerStateStore = $derived(
    recordDrawerWorkspace.openEntryIndexHandlerStateStore,
  );
  let drawerShellDisplay = $derived($drawerShellDisplayStateStore);
  let contentDisplay = $derived($contentDisplayStateStore);
  let drawerContentDisplay = $derived($drawerContentDisplayStateStore);
  let openEntryIndexHandler = $derived($openEntryIndexHandlerStateStore);
  let historyDisplay = $derived($historyDisplayStateStore);
  let sessionRecordsView = $derived($sessionRecordsViewState);

  function handleSessionRecordsViewChange(nextView) {
    const selectedView = setSessionRecordsView(nextView);
    if (selectedView === SESSION_RECORDS_VIEW.history) {
      void refreshHistory();
    }
  }

  $effect(() => {
    recordDrawerWorkspace.setDrawerContext({
      entryCount: contentDisplay.entryCount,
      recording: $recordDrawerRecordingState,
    });
  });

  $effect(() => {
    recordDrawerWorkspace.ensurePreferencesLoaded();
  });
</script>

<DashboardDrawerShell
  {drawerShellDisplay}
  onClose={closeRecordDrawer}
  class="data-[side=right]:w-[min(100vw,64rem)] data-[side=right]:sm:max-w-3xl data-[side=right]:xl:max-w-4xl"
>
  <Tabs.Root
    value={sessionRecordsView}
    onValueChange={handleSessionRecordsViewChange}
    class="min-h-0 flex-1 gap-0"
  >
    <div class="border-b border-border px-4 py-3">
      <Tabs.List
        variant="line"
        class="!grid !h-auto w-full grid-cols-2 gap-1"
        aria-label={drawerShellDisplay.viewLabel}
      >
        <Tabs.Trigger
          value={SESSION_RECORDS_VIEW.recent}
          class="h-10 min-w-0 justify-center rounded-lg border-border/70 bg-card/70 px-2 text-xs hover:border-primary/30 hover:bg-primary/5 hover:text-primary data-active:!border-primary/60 data-active:!bg-primary/10 data-active:!text-primary after:inset-x-3 after:bottom-0 after:rounded-full after:bg-primary"
        >
          <VideoIcon aria-hidden="true" />
          <span>{drawerShellDisplay.viewTabs[0].label}</span>
        </Tabs.Trigger>
        <Tabs.Trigger
          value={SESSION_RECORDS_VIEW.history}
          class="h-10 min-w-0 justify-center rounded-lg border-border/70 bg-card/70 px-2 text-xs hover:border-primary/30 hover:bg-primary/5 hover:text-primary data-active:!border-primary/60 data-active:!bg-primary/10 data-active:!text-primary after:inset-x-3 after:bottom-0 after:rounded-full after:bg-primary"
        >
          <HistoryIcon aria-hidden="true" />
          <span>{drawerShellDisplay.viewTabs[1].label}</span>
        </Tabs.Trigger>
      </Tabs.List>
    </div>

    <Tabs.Content
      value={SESSION_RECORDS_VIEW.recent}
      class="mt-0 min-h-0 overflow-hidden data-active:flex"
    >
      <RecordDrawerContent
        {drawerContentDisplay}
        onCopyRecording={recordDrawerWorkspace.copyRecording}
        onEventKindChange={recordDrawerWorkspace.setEventKind}
        onFailedOnlyChange={recordDrawerWorkspace.setFailedOnly}
        onModeSelect={recordDrawerWorkspace.selectDisplayMode}
        onOpenEntryIndex={openEntryIndexHandler}
        onRawInput={recordDrawerWorkspace.setRawRecordingText}
        onRecordLevelChange={recordDrawerWorkspace.setRecordLevel}
        onResetFilters={recordDrawerWorkspace.resetFilters}
        onSearchInput={recordDrawerWorkspace.setSearchQuery}
        onUseInReplay={recordDrawerWorkspace.useInReplay}
      />
    </Tabs.Content>

    <Tabs.Content
      value={SESSION_RECORDS_VIEW.history}
      class="mt-0 min-h-0 overflow-hidden data-active:flex"
    >
      <HistoryDrawerContent
        {historyDisplay}
        onDeleteItem={deleteHistoryItem}
        onLimitChange={changeLimit}
        onOpenItem={openHistoryItem}
        onOperationChange={changeOperation}
        onQueryInput={changeQuery}
        onClearFilters={clearFilters}
        onRefresh={refreshHistory}
      />
    </Tabs.Content>
  </Tabs.Root>
</DashboardDrawerShell>

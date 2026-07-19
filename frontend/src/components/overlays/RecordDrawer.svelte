<script>
  import DashboardDrawerShell from "./DashboardDrawerShell.svelte";
  import RecordDrawerContent from "./RecordDrawerContent.svelte";
  import {
    closeRecordDrawer,
    createRecordDrawerWorkspace,
    recordDrawerRecordingState,
    recordLevelState,
  } from "../../modules/overlays/overlays.js";
  const recordDrawerWorkspace = createRecordDrawerWorkspace();
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
  let displayModeStore = $derived(recordDrawerWorkspace.displayModeStore);
  let eventKindStore = $derived(recordDrawerWorkspace.eventKindStore);
  let failedOnlyStore = $derived(recordDrawerWorkspace.failedOnlyStore);
  let recordingJsonlStore = $derived(recordDrawerWorkspace.recordingJsonlStore);
  let searchQueryStore = $derived(recordDrawerWorkspace.searchQueryStore);
  let drawerShellDisplay = $derived($drawerShellDisplayStateStore);
  let contentDisplay = $derived($contentDisplayStateStore);
  let drawerContentDisplay = $derived($drawerContentDisplayStateStore);
  let openEntryIndexHandler = $derived($openEntryIndexHandlerStateStore);

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

<DashboardDrawerShell {drawerShellDisplay} onClose={closeRecordDrawer}>
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
</DashboardDrawerShell>

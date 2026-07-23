<script>
  import * as Card from "$lib/components/ui/card";
  import DashboardTabPanel from "../components/layout/DashboardTabPanel.svelte";
  import WorkspaceActionHeader from "../components/fragments/WorkspaceActionHeader.svelte";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import { displayModeTabs } from "../config/dashboardModes.js";
  import { createReplayPageWorkspace } from "../modules/operations/replay.js";
  import ReplayControlsPanel from "./replay/ReplayControlsPanel.svelte";
  import ReplayResultsPanel from "./replay/ReplayResultsPanel.svelte";

  let { active } = $props();
  const replayPageWorkspace = createReplayPageWorkspace({
    modeTabs: displayModeTabs,
  });
  const {
    replayDisplayStateStore,
    replayEntryOpenIndexHandlerStateStore,
    replayResultsDisplayStateStore,
  } = replayPageWorkspace;
  let replayDisplay = $derived($replayDisplayStateStore);
  let replayResultsDisplay = $derived($replayResultsDisplayStateStore);
  let replayEntryOpenIndexHandler = $derived(
    $replayEntryOpenIndexHandlerStateStore,
  );

  $effect(() => {
    replayPageWorkspace.setPageContext({ active });
  });
</script>

<DashboardTabPanel {active}>
  <Card.Root class="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
    <WorkspaceActionHeader
      title={replayDisplay.controlsDisplay.panelTitle}
      icon={HistoryIcon}
    />
    <Card.Content class="grid gap-2 p-4 sm:p-5">
      <ReplayControlsPanel
        controlsDisplay={replayDisplay.controlsDisplay}
        onList={replayPageWorkspace.replayList}
        onCommandInput={replayPageWorkspace.setCommandInput}
        onEventKindChange={replayPageWorkspace.setEventKind}
        onFailedOnlyChange={replayPageWorkspace.setFailedOnly}
        onJsonlInput={replayPageWorkspace.setJsonl}
        onModeSelect={replayPageWorkspace.selectReplayTab}
        onModeInput={replayPageWorkspace.setMode}
        onResetFilters={replayPageWorkspace.resetFilters}
        onRun={replayPageWorkspace.replayCommand}
        onSearchInput={replayPageWorkspace.setSearchQuery}
      />
      <ReplayResultsPanel
        resultsDisplay={replayResultsDisplay}
        onOpenEntryIndex={replayEntryOpenIndexHandler}
      />
    </Card.Content>
  </Card.Root>
</DashboardTabPanel>

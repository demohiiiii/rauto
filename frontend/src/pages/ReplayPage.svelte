<script>
  import * as Card from "$lib/components/ui/card";
  import DashboardTabPanel from "../components/layout/DashboardTabPanel.svelte";
  import { displayModeTabs } from "../config/dashboardModes.js";
  import { createReplayPageWorkspace } from "../modules/replay.js";
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
  <Card.Root>
    <Card.Header>
      <Card.Title>
        {replayDisplay.controlsDisplay.panelTitle}
      </Card.Title>
    </Card.Header>
    <Card.Content class="grid gap-2">
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

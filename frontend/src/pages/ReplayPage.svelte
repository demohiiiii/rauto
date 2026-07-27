<script>
  import * as Card from "$lib/components/ui/card";
  import DashboardTabPanel from "../components/layout/DashboardTabPanel.svelte";
  import WorkspaceActionHeader from "../components/fragments/WorkspaceActionHeader.svelte";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import TerminalIcon from "@lucide/svelte/icons/terminal";
  import { displayModeTabs } from "../config/dashboardModes.js";
  import { currentLanguageState, t } from "../lib/i18n.js";
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
  let i18nCurrentLanguage = $derived($currentLanguageState);
  let i18nLabels = $derived.by(() => {
    i18nCurrentLanguage;
    return {
      pageHint: t("replayPageHint"),
      resultsTitle: t("replayResultsTitle"),
    };
  });

  $effect(() => {
    replayPageWorkspace.setPageContext({ active });
  });

  $effect(() => replayPageWorkspace.destroy);
</script>

<DashboardTabPanel {active}>
  <div class="grid gap-3">
    <Card.Root class="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
      <WorkspaceActionHeader
        title={replayDisplay.controlsDisplay.panelTitle}
        description={i18nLabels.pageHint}
        icon={HistoryIcon}
      />
      <Card.Content class="flex flex-col gap-4 p-4 sm:p-5">
        <ReplayControlsPanel
          controlsDisplay={replayDisplay.controlsDisplay}
          onList={replayPageWorkspace.replayList}
          onCommandInput={replayPageWorkspace.setCommandInput}
          onJsonlInput={replayPageWorkspace.setJsonl}
          onModeInput={replayPageWorkspace.setMode}
          onRun={replayPageWorkspace.replayCommand}
        />
      </Card.Content>
    </Card.Root>

    <Card.Root class="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
      <WorkspaceActionHeader
        title={i18nLabels.resultsTitle}
        icon={TerminalIcon}
      />
      <Card.Content class="flex flex-col gap-4 p-4 sm:p-5">
        <ReplayResultsPanel
          controlsDisplay={replayDisplay.controlsDisplay}
          resultsDisplay={replayResultsDisplay}
          onEventKindChange={replayPageWorkspace.setEventKind}
          onFailedOnlyChange={replayPageWorkspace.setFailedOnly}
          onModeSelect={replayPageWorkspace.selectReplayTab}
          onOpenEntryIndex={replayEntryOpenIndexHandler}
          onResetFilters={replayPageWorkspace.resetFilters}
          onSearchInput={replayPageWorkspace.setSearchQuery}
        />
      </Card.Content>
    </Card.Root>
  </div>
</DashboardTabPanel>

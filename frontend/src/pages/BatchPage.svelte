<script>
  import * as Card from "$lib/components/ui/card/index.js";
  import TabList from "../components/fragments/TabList.svelte";
  import WorkspaceActionHeader from "../components/fragments/WorkspaceActionHeader.svelte";
  import LayersIcon from "@lucide/svelte/icons/layers";
  import DashboardTabPanel from "../components/layout/DashboardTabPanel.svelte";
  import {
    BATCH_EXEC_MODE,
    batchExecModeTabs,
    defaultBatchExecMode,
    normalizeBatchExecMode,
  } from "../config/dashboardModes.js";
  import { currentLanguageState, t } from "../lib/i18n.js";
  import BatchExecPanel from "./batch/BatchExecPanel.svelte";
  import BatchFlowPanel from "./batch/BatchFlowPanel.svelte";

  let { active } = $props();
  let currentMode = $state(defaultBatchExecMode);
  let currentLanguage = $derived($currentLanguageState);
  let pageLabels = $derived.by(() => {
    currentLanguage;
    return {
      title: t("opSectionBatch"),
      hint: t("batchPageHint"),
      modeAriaLabel: t("opSectionBatch"),
    };
  });
  let commandActive = $derived(
    active && currentMode === BATCH_EXEC_MODE.command,
  );
  let flowActive = $derived(active && currentMode === BATCH_EXEC_MODE.flow);

  function selectMode(mode) {
    currentMode = normalizeBatchExecMode(mode);
  }
</script>

<DashboardTabPanel {active}>
  <div class="grid gap-3">
    <Card.Root class="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
      <WorkspaceActionHeader
        title={pageLabels.title}
        description={pageLabels.hint}
        icon={LayersIcon}
      >
        {#snippet actions()}
          <TabList
            tabItems={batchExecModeTabs}
            activeValue={currentMode}
            aria-label={pageLabels.modeAriaLabel}
            themeAware={true}
            onSelect={selectMode}
          />
        {/snippet}
      </WorkspaceActionHeader>

      <Card.Content class="grid min-w-0 p-0">
        {#if commandActive}
          <BatchExecPanel active={true} />
        {:else if flowActive}
          <BatchFlowPanel active={true} />
        {/if}
      </Card.Content>
    </Card.Root>
  </div>
</DashboardTabPanel>

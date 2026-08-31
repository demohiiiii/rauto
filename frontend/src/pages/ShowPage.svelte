<script lang="ts">
  import { showQueryTabs } from "../config/dashboardModes.js";
  import {
    createShowPageWorkspace,
    showConnectionTargetState,
    showExecutionConnectionProfileState,
  } from "$domains/show/index.js";
  import { afterDomUpdate } from "../lib/svelte.js";
  import BatchShowInputPanel from "./show/BatchShowInputPanel.svelte";
  import BatchShowResultsPanel from "./show/BatchShowResultsPanel.svelte";
  import SingleShowPanel from "./show/SingleShowPanel.svelte";

  let { active }: { active: boolean } = $props();
  const showQueryTabItems = [...showQueryTabs];
  const showPageWorkspace = createShowPageWorkspace({ afterDomUpdate });
  const {
    batchResultDisplayStateStore,
    batchResultsPresentationStateStore,
    currentQueryState,
    pageDisplayStateStore,
  } = showPageWorkspace;
  let currentTab = $derived($currentQueryState);
  let pageDisplay = $derived($pageDisplayStateStore);
  let singleActive = $derived(active && pageDisplay.singleActive);
  let batchActive = $derived(active && pageDisplay.batchActive);
  let batchResultDisplay = $derived($batchResultDisplayStateStore);
  let batchResultsPresentation = $derived($batchResultsPresentationStateStore);
  $effect(() => {
    showPageWorkspace.setRouteContext({
      active,
      profile: $showExecutionConnectionProfileState,
      target: $showConnectionTargetState,
    });
  });

  $effect(() => {
    if (active) return;
    showPageWorkspace.destroy();
  });
</script>

<div class="tab-panel" role="tabpanel" hidden={!active}>
  <div class="grid gap-3">
    {#if singleActive}
      <SingleShowPanel
        active={true}
        tabItems={showQueryTabItems}
        {currentTab}
        queryAriaLabel={pageDisplay.queryAriaLabel}
        onSelectQuery={showPageWorkspace.selectQuery}
      />
    {:else if batchActive}
      <div class="grid gap-3">
        <BatchShowInputPanel
          active={true}
          tabItems={showQueryTabItems}
          {currentTab}
          queryAriaLabel={pageDisplay.queryAriaLabel}
          onSelectQuery={showPageWorkspace.selectQuery}
        />
        <BatchShowResultsPanel
          {batchResultDisplay}
          {batchResultsPresentation}
        />
      </div>
    {/if}
  </div>
</div>

<script>
  import * as Card from "$lib/components/ui/card";
  import { showQueryTabs } from "../config/dashboardModes.js";
  import { afterDomUpdate } from "../lib/svelte.js";
  import { createShowPageWorkspace } from "../modules/operations/showQueryWorkspaces.js";
  import {
    showConnectionTargetState,
    showExecutionConnectionProfileState,
  } from "../modules/operations/showQueryState.js";
  import BatchShowInputPanel from "./show/BatchShowInputPanel.svelte";
  import BatchShowResultsPanel from "./show/BatchShowResultsPanel.svelte";
  import SingleShowPanel from "./show/SingleShowPanel.svelte";

  let { active } = $props();
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
  <div class="mx-auto flex w-full max-w-4xl flex-col gap-6">
    <Card.Root class="contents bg-transparent p-0 shadow-none ring-0">
      <Card.Header class="sr-only">
        <Card.Title class="sr-only">{pageDisplay.title}</Card.Title>
      </Card.Header>
      <Card.Content class="flex flex-col gap-6 p-0">
        {#if singleActive}
          <SingleShowPanel
            active={true}
            tabItems={showQueryTabs}
            {currentTab}
            queryAriaLabel={pageDisplay.queryAriaLabel}
            onSelectQuery={showPageWorkspace.selectQuery}
          />
        {:else if batchActive}
          <div class="grid gap-6">
            <BatchShowInputPanel
              active={true}
              tabItems={showQueryTabs}
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
      </Card.Content>
    </Card.Root>
  </div>
</div>

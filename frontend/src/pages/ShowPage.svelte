<script>
  import * as Card from "$lib/components/ui/card";
  import { showQueryTabs } from "../config/dashboardModes.js";
  import { afterDomUpdate } from "../lib/svelte.js";
  import {
    createShowPageWorkspace,
    showConnectionTargetState,
    showExecutionConnectionProfileState,
  } from "../modules/show.js";
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
  let targetName = $derived.by(() => {
    const details = $showConnectionTargetState?.details || {};
    return details.name || details.host || "";
  });

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
        <div class="flex items-end justify-between gap-4">
          <div>
            <div
              class="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted-foreground"
            >
              <span>控制台</span>
              <span class="text-muted-foreground/40" aria-hidden="true">/</span>
              <span class="text-primary">{pageDisplay.title}</span>
            </div>
            <h2 class="text-2xl font-bold tracking-tight text-foreground">
              {pageDisplay.title}
            </h2>
            <p class="mt-1 text-sm text-muted-foreground">
              向目标设备下发只读命令，并按需解析为结构化结果
            </p>
          </div>
          {#if targetName}
            <span
              class="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-xs sm:inline-flex"
            >
              <span class="size-2 rounded-full bg-primary"></span>
              目标
              <span class="font-mono text-foreground">{targetName}</span>
            </span>
          {/if}
        </div>

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

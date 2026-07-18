<script>
  import * as Card from "$lib/components/ui/card/index.js";
  import TabList from "../components/fragments/TabList.svelte";
  import WorkspaceActionHeader from "../components/fragments/WorkspaceActionHeader.svelte";
  import DashboardTabPanel from "../components/layout/DashboardTabPanel.svelte";
  import { standardExecModeTabs } from "../config/dashboardModes.js";
  import {
    createStandardPageWorkspace,
    standardExecutionConnectionProfileState,
  } from "../modules/standard.js";
  import CommandExecutionPanel from "./standard/CommandExecutionPanel.svelte";
  import FlowExecutionPanel from "./standard/FlowExecutionPanel.svelte";

  let { active } = $props();
  const standardPageWorkspace = createStandardPageWorkspace();
  const { currentExecModeState, pageDisplayStateStore } = standardPageWorkspace;
  let currentExecMode = $derived($currentExecModeState);
  let pageDisplay = $derived($pageDisplayStateStore);
  let directActive = $derived(active && pageDisplay.directActive);
  let flowActive = $derived(active && pageDisplay.flowActive);

  $effect(() => {
    standardPageWorkspace.setRouteContext({
      active,
      profile: $standardExecutionConnectionProfileState,
    });
  });
  $effect(() => {
    if (active) return;
    standardPageWorkspace.destroy();
  });
</script>

<DashboardTabPanel {active}>
  <div class="grid gap-3">
    <Card.Root class="gap-0 overflow-hidden py-0">
      <WorkspaceActionHeader
        title={pageDisplay.title}
        description={pageDisplay.hint}
      >
        {#snippet actions()}
          <TabList
            tabItems={standardExecModeTabs}
            activeValue={currentExecMode}
            aria-label={pageDisplay.execModeAriaLabel}
            themeAware={true}
            onSelect={standardPageWorkspace.selectExecMode}
          />
        {/snippet}
      </WorkspaceActionHeader>

      <Card.Content class="grid min-w-0 p-0">
        {#if directActive}
          <CommandExecutionPanel active={true} />
        {:else if flowActive}
          <FlowExecutionPanel active={true} />
        {/if}
      </Card.Content>
    </Card.Root>
  </div>
</DashboardTabPanel>

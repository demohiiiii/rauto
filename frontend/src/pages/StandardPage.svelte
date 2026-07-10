<script>
  import CollapsibleGroup from "../components/fragments/CollapsibleGroup.svelte";
  import TabList from "../components/fragments/TabList.svelte";
  import DashboardTabPanel from "../components/layout/DashboardTabPanel.svelte";
  import { standardExecModeTabs } from "../config/dashboardModes.js";
  import {
    createStandardPageWorkspace,
    standardExecutionConnectionProfileState,
  } from "../modules/standard.js";
  import DirectExecutionPanel from "./standard/DirectExecutionPanel.svelte";
  import FlowExecutionPanel from "./standard/FlowExecutionPanel.svelte";
  import TemplateExecutionPanel from "./standard/TemplateExecutionPanel.svelte";

  let { active } = $props();
  const standardPageWorkspace = createStandardPageWorkspace();
  const { currentExecModeState, pageDisplayStateStore } = standardPageWorkspace;
  let currentExecMode = $derived($currentExecModeState);
  let pageDisplay = $derived($pageDisplayStateStore);
  let directActive = $derived(active && pageDisplay.directActive);
  let templateActive = $derived(active && pageDisplay.templateActive);
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

<DashboardTabPanel {active} titleKey="opSectionStandard">
  <div class="mt-3 grid gap-3">
    <CollapsibleGroup persistenceKey="ops-main-body">
      {#snippet header()}
        <span>{pageDisplay.title}</span>
      {/snippet}

      <TabList
        tabItems={standardExecModeTabs}
        activeValue={currentExecMode}
        aria-label={pageDisplay.execModeAriaLabel}
        onSelect={standardPageWorkspace.selectExecMode}
      />

      <div class="grid gap-3">
        {#if directActive}
          <DirectExecutionPanel active={true} />
        {:else if templateActive}
          <TemplateExecutionPanel active={true} />
        {:else if flowActive}
          <FlowExecutionPanel active={true} />
        {/if}
      </div>
    </CollapsibleGroup>
  </div>
</DashboardTabPanel>

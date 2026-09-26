<script lang="ts">
  import SearchIcon from "@lucide/svelte/icons/search";
  import ExecutionDock from "$components/fragments/ExecutionDock.svelte";
  import ExecutionScopePanel from "$components/fragments/ExecutionScopePanel.svelte";
  import { currentLanguageState, t } from "$lib/i18n.js";
  import { afterDomUpdate } from "$lib/svelte.js";
  import {
    createShowPageWorkspace,
    showConnectionTargetState,
    showExecutionConnectionProfileState,
  } from "$domains/show/index.js";
  import BatchShowInputPanel from "./BatchShowInputPanel.svelte";
  import SingleShowPanel from "./SingleShowPanel.svelte";

  let { active }: { active: boolean } = $props();
  let labels = $derived.by(() => {
    $currentLanguageState;
    return { title: t("showPanelConfigTitle"), hint: t("showPanelConfigHint") };
  });
  const showPageWorkspace = createShowPageWorkspace({ afterDomUpdate });
  const { currentQueryState, pageDisplayStateStore } = showPageWorkspace;
  let currentTab = $derived($currentQueryState);
  let pageDisplay = $derived($pageDisplayStateStore);
  let singleActive = $derived(active && pageDisplay.singleActive);
  let batchActive = $derived(active && pageDisplay.batchActive);

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
  <ExecutionDock {active} feature="show">
    <ExecutionScopePanel
      title={labels.title}
      description={labels.hint}
      icon={SearchIcon}
      activeValue={currentTab}
      ariaLabel={pageDisplay.queryAriaLabel}
      onSelect={showPageWorkspace.selectQuery}
    >
      {#if singleActive}
        <div class="workspace-panel-enter">
          <SingleShowPanel active={true} />
        </div>
      {:else if batchActive}
        <div class="workspace-panel-enter min-w-0">
          <BatchShowInputPanel active={true} />
        </div>
      {/if}
    </ExecutionScopePanel>
  </ExecutionDock>
</div>

<script lang="ts">
  import SearchIcon from "@lucide/svelte/icons/search";
  import ExecutionScopePanel from "$components/fragments/ExecutionScopePanel.svelte";
  import { currentLanguageState, t } from "$lib/i18n.js";
  import { afterDomUpdate } from "$lib/svelte.js";
  import {
    createShowPageWorkspace,
    showConnectionTargetState,
    showExecutionConnectionProfileState,
  } from "$domains/show/index.js";
  import BatchShowInputPanel from "./BatchShowInputPanel.svelte";
  import BatchShowResultsPanel from "./BatchShowResultsPanel.svelte";
  import SingleShowPanel from "./SingleShowPanel.svelte";

  let { active }: { active: boolean } = $props();
  let labels = $derived.by(() => {
    $currentLanguageState;
    return { title: t("showPanelConfigTitle"), hint: t("showPanelConfigHint") };
  });
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
        <div class="workspace-panel-enter grid gap-3">
          <BatchShowInputPanel active={true} />
          <BatchShowResultsPanel
            {batchResultDisplay}
            {batchResultsPresentation}
          />
        </div>
      {/if}
    </ExecutionScopePanel>
  </div>
</div>

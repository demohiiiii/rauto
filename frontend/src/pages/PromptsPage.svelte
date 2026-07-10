<script>
  import DashboardTabPanel from "../components/layout/DashboardTabPanel.svelte";
  import OutputBlock from "../components/fragments/OutputBlock.svelte";
  import StringSelectField from "../components/fragments/StringSelectField.svelte";
  import TabList from "../components/fragments/TabList.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { promptModeTabs } from "../config/dashboardModes.js";
  import StatusCard from "../components/fragments/StatusCard.svelte";
  import {
    changeBuiltinProfileSelection,
    createPromptProfilesPageWorkspace,
  } from "../modules/profiles.js";
  import BuiltinProfileDetailsPanel from "./prompts/BuiltinProfileDetailsPanel.svelte";
  import CustomProfilesEditorPanel from "./prompts/CustomProfilesEditorPanel.svelte";
  import ProfileDiagnosePanel from "./prompts/ProfileDiagnosePanel.svelte";

  let { active } = $props();
  const promptPageWorkspace = createPromptProfilesPageWorkspace();
  const {
    builtinPanelDisplayStateStore,
    currentPromptModeState,
    pageDisplayStateStore,
  } = promptPageWorkspace;
  let currentPromptMode = $derived($currentPromptModeState);
  let pageDisplay = $derived($pageDisplayStateStore);
  let builtinPanelDisplay = $derived($builtinPanelDisplayStateStore);

  $effect(() => {
    promptPageWorkspace.setPageContext({ active });
  });
</script>

<DashboardTabPanel {active} titleKey="promptProfilesTitle">
  <TabList
    tabItems={promptModeTabs}
    activeValue={currentPromptMode}
    aria-label={pageDisplay.tabAriaLabel}
    class="mt-3 w-fit"
    onSelect={promptPageWorkspace.setPromptMode}
  />

  {#if pageDisplay.builtinActive}
    <div class="mt-4">
      <h3 class="mb-2 text-sm font-semibold text-slate-700">
        {builtinPanelDisplay.title}
      </h3>
      <div class="grid gap-2 md:w-160 md:grid-cols-[1fr_auto]">
        <StringSelectField
          title={builtinPanelDisplay.selectPlaceholder}
          aria-label={builtinPanelDisplay.selectPlaceholder}
          value={builtinPanelDisplay.overview.selectedName}
          placeholderText={builtinPanelDisplay.selectPlaceholder}
          optionValues={builtinPanelDisplay.overview.profileNames}
          onChange={changeBuiltinProfileSelection}
        />
        <Button
          size="sm"
          type="button"
          onclick={promptPageWorkspace.copyBuiltinProfileToCustomAndEdit}
        >
          {builtinPanelDisplay.copyButtonLabel}
        </Button>
      </div>
      <OutputBlock class="mt-2"
        >{builtinPanelDisplay.overview.overviewText}</OutputBlock
      >
      <BuiltinProfileDetailsPanel profileDetail={builtinPanelDisplay.detail} />
      {#if builtinPanelDisplay.status.show}
        <div class="mt-3 grid gap-2">
          <StatusCard
            message={builtinPanelDisplay.status.message}
            tone={builtinPanelDisplay.status.tone}
          />
        </div>
      {/if}
    </div>
  {:else if pageDisplay.editActive}
    <CustomProfilesEditorPanel
      active={active && pageDisplay.editActive}
      customStatusMessage={pageDisplay.customStatus.message}
      customStatusTone={pageDisplay.customStatus.tone}
      customTitle={pageDisplay.customTitle}
      hooksHint={pageDisplay.hooksHint}
      hooksTitle={pageDisplay.hooksTitle}
      showCustomStatus={pageDisplay.customStatus.show}
    />
  {:else if pageDisplay.diagnoseActive}
    <ProfileDiagnosePanel />
  {/if}
</DashboardTabPanel>

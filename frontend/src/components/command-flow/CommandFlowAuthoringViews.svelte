<script>
  import TabList from "../fragments/TabList.svelte";
  import TextAreaField from "../fragments/TextAreaField.svelte";
  import { commandFlowEditorViewTabs } from "../../config/dashboardModes.js";
  import CommandFlowReadonlyView from "./CommandFlowReadonlyView.svelte";
  import CommandFlowTemplateEditor from "./CommandFlowTemplateEditor.svelte";

  let {
    activeTab = "visual",
    ariaLabel = "",
    disabled = false,
    modeOptions = [],
    model = {},
    onModelChange,
    onSelectTab,
    onTomlChange,
    tomlHint = "",
    tomlLabel = "",
    tomlText = "",
  } = $props();
</script>

<div
  class="flex min-w-0 flex-wrap items-center gap-2 border-b border-border px-4 py-3 sm:px-6"
>
  <TabList
    tabItems={commandFlowEditorViewTabs}
    activeValue={activeTab}
    aria-label={ariaLabel}
    onSelect={onSelectTab}
  />
</div>

{#if activeTab === "visual"}
  <fieldset class="contents" {disabled}>
    <CommandFlowTemplateEditor
      {model}
      {modeOptions}
      showNameField={false}
      surfaceVariant="workbench-section"
      settingsIndexText="01"
      stepsIndexText="02"
      addStepPlacement="footer"
      onChange={onModelChange}
    />
  </fieldset>
{:else if activeTab === "readonly"}
  <CommandFlowReadonlyView {model} />
{:else}
  <div class="min-w-0 px-4 py-5 sm:px-6">
    <TextAreaField
      class="min-h-[30rem] font-mono text-sm"
      labelText={tomlLabel}
      hintText={tomlHint}
      value={tomlText}
      {disabled}
      onValueInput={onTomlChange}
    />
  </div>
{/if}

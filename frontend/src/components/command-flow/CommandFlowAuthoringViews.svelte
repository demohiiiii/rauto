<script lang="ts">
  import TabList from "../fragments/TabList.svelte";
  import TextAreaField from "../fragments/TextAreaField.svelte";
  import { commandFlowEditorViewTabs } from "../../config/dashboardModes.js";
  import {
    defaultCommandFlowTemplateModel,
    defaultCommandFlowTemplateStepModel,
    type CommandFlowEditorTab,
    type CommandFlowTemplateModel,
  } from "$domains/command/index.js";
  import CommandFlowReadonlyView from "./CommandFlowReadonlyView.svelte";
  import CommandFlowTemplateEditor from "./CommandFlowTemplateEditor.svelte";
  import CommandFlowTemplateStepEditor from "./CommandFlowTemplateStepEditor.svelte";

  interface Props {
    activeTab?: CommandFlowEditorTab;
    ariaLabel?: string;
    disabled?: boolean;
    modeOptions?: string[];
    model?: CommandFlowTemplateModel;
    onModelChange?: (model: CommandFlowTemplateModel) => void;
    onSelectTab?: (tab: string) => void;
    onTomlChange?: (tomlText: string) => void;
    tomlHint?: string;
    tomlLabel?: string;
    tomlText?: string;
  }

  let {
    activeTab = "visual",
    ariaLabel = "",
    disabled = false,
    modeOptions = [],
    model = defaultCommandFlowTemplateModel(),
    onModelChange,
    onSelectTab,
    onTomlChange,
    tomlHint = "",
    tomlLabel = "",
    tomlText = "",
  }: Props = $props();
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
      createStep={defaultCommandFlowTemplateStepModel}
      {modeOptions}
      showNameField={false}
      surfaceVariant="section"
      addStepPlacement="footer"
      onChange={onModelChange}
    >
      {#snippet renderStepContent(stepRow)}
        <CommandFlowTemplateStepEditor
          step={stepRow.flowStep}
          accentIndex={stepRow.accentIndex}
          {modeOptions}
          onChange={stepRow.onChange}
        />
      {/snippet}
    </CommandFlowTemplateEditor>
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

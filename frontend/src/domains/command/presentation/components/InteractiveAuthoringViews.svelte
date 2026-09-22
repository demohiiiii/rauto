<script lang="ts">
  import TabList from "$components/fragments/TabList.svelte";
  import GitBranchIcon from "@lucide/svelte/icons/git-branch";
  import { currentLanguageState, t } from "$lib/i18n.js";
  import TextAreaField from "$components/fragments/TextAreaField.svelte";
  import { interactiveEditorViewTabs } from "$config/dashboardModes.js";
  import {
    defaultInteractiveTemplateModel,
    type InteractiveEditorTab,
    type InteractiveTemplateModel,
  } from "$domains/command/index.js";
  import InteractiveReadonlyView from "./InteractiveReadonlyView.svelte";
  import InteractiveCommandEditor from "./InteractiveCommandEditor.svelte";

  interface Props {
    studio?: boolean;
    activeTab?: InteractiveEditorTab;
    ariaLabel?: string;
    disabled?: boolean;
    modeOptions?: string[];
    model?: InteractiveTemplateModel;
    onModelChange?: (model: InteractiveTemplateModel) => void;
    onSelectTab?: (tab: string) => void;
    onTomlChange?: (tomlText: string) => void;
    tomlHint?: string;
    tomlLabel?: string;
    tomlText?: string;
  }

  let {
    studio = false,
    activeTab = "visual",
    ariaLabel = "",
    disabled = false,
    modeOptions = [],
    model = defaultInteractiveTemplateModel(),
    onModelChange,
    onSelectTab,
    onTomlChange,
    tomlHint = "",
    tomlLabel = "",
    tomlText = "",
  }: Props = $props();
  let sequenceLabel = $derived.by(() => {
    $currentLanguageState;
    return t("interactiveStudioSequence");
  });
</script>

<div
  class="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5"
>
  {#if studio}
    <h3 class="flex items-center gap-2 text-sm font-semibold">
      <GitBranchIcon class="size-4 text-primary" />{sequenceLabel}
    </h3>
  {/if}
  <TabList
    tabItems={interactiveEditorViewTabs}
    activeValue={activeTab}
    aria-label={ariaLabel}
    onSelect={onSelectTab}
    themeAware={studio}
  />
</div>

{#if activeTab === "visual"}
  <fieldset class={studio ? "min-w-0 p-4 sm:p-5" : "contents"} {disabled}>
    <InteractiveCommandEditor
      compact={studio}
      step={model}
      {modeOptions}
      onChange={(command) => onModelChange?.({ ...model, ...command })}
    />
  </fieldset>
{:else if activeTab === "readonly"}
  <InteractiveReadonlyView {model} />
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

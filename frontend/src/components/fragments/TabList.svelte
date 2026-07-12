<script>
  import { untrack } from "svelte";
  import * as Tabs from "$lib/components/ui/tabs/index.js";
  import { currentLanguageState } from "../../lib/i18n.js";
  import {
    callIfFunction,
    tabListSelectionBindings,
  } from "../../lib/events.js";
  import { tabListPresentation } from "../../lib/ui.js";

  let {
    tabItems,
    activeValue,
    "aria-label": ariaLabel,
    class: rootClass = "w-fit",
    onSelect,
  } = $props();
  let selectedValue = $state(untrack(() => activeValue));
  let currentLanguage = $derived($currentLanguageState);
  let tabDisplay = $derived.by(() => {
    currentLanguage;
    return tabListPresentation({ activeValue, ariaLabel, tabItems });
  });

  const selectionBindings = tabListSelectionBindings({
    getActiveValue: () => activeValue,
    onSelect: (nextValue) => callIfFunction(onSelect, nextValue),
    onSelectedValueChange: (nextValue) => {
      selectedValue = nextValue;
    },
  });

  $effect(() => {
    selectedValue = activeValue;
  });
</script>

<Tabs.Root
  bind:value={selectedValue}
  onValueChange={selectionBindings.valueChangeHandler}
  class={rootClass}
>
  <Tabs.List aria-label={tabDisplay.ariaLabelText}>
    {#each tabDisplay.tabRows as tabRow (tabRow.valueText)}
      <Tabs.Trigger value={tabRow.valueText}>
        {tabRow.labelText}
      </Tabs.Trigger>
    {/each}
  </Tabs.List>
</Tabs.Root>

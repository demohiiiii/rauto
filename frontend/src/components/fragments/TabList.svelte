<script>
  import * as Tabs from "$lib/components/ui/tabs/index.js";
  import { currentLanguageState } from "../../lib/i18n.js";
  import { callIfFunction } from "../../lib/events.js";
  import { tabListPresentation } from "../../lib/ui.js";

  let {
    tabItems,
    activeValue,
    "aria-label": ariaLabel,
    class: rootClass = "w-fit",
    onSelect,
  } = $props();
  let currentLanguage = $derived($currentLanguageState);
  let tabDisplay = $derived.by(() => {
    currentLanguage;
    return tabListPresentation({ activeValue, ariaLabel, tabItems });
  });

  function handleValueChange(nextValue) {
    return callIfFunction(onSelect, nextValue);
  }
</script>

<Tabs.Root
  value={activeValue}
  onValueChange={handleValueChange}
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

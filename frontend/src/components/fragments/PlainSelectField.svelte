<script>
  import * as Select from "$lib/components/ui/select/index.js";
  import { classNames } from "../../lib/ui.js";
  import { focusElementAfterDomUpdate } from "../../lib/svelte.js";
  import { plainSelectFieldBindings } from "../../lib/events.js";

  const defaultRootClass = "w-full min-w-0";
  const defaultTriggerClass =
    "!w-full max-w-full min-w-0 justify-between overflow-hidden";

  let {
    value = "",
    optionRows = [],
    "aria-label": ariaLabel = "",
    title = "",
    "focus-request-version": focusRequestVersion = 0,
    disabled = false,
    hidden = false,
    class: selectClass = "",
    onChange,
    onValueChange,
    onchange = null,
  } = $props();
  let selectBindings = $derived(
    plainSelectFieldBindings({
      onChange: typeof onchange === "function" ? onchange : onChange,
      onValueChange,
    }),
  );
  let selectedValue = $state("");
  let lastPropValue = $state("");
  let lastEmittedValue = $state("");
  let mounted = $state(false);
  let selectTriggerElement = $state(null);
  let lastFocusRequestVersion = $state(0);
  let rootClassName = $derived(defaultRootClass);
  let triggerClassName = $derived(classNames(defaultTriggerClass, selectClass));
  let selectedLabel = $derived(
    optionRows.find((optionRow) => optionRow.optionValue === selectedValue)
      ?.optionLabel ||
      title ||
      ariaLabel ||
      "-",
  );

  function selectChangeEvent(nextValue = "") {
    return {
      currentTarget: { value: nextValue },
      target: { value: nextValue },
    };
  }

  $effect(() => {
    if (
      !focusRequestVersion ||
      focusRequestVersion === lastFocusRequestVersion
    ) {
      return;
    }
    lastFocusRequestVersion = focusRequestVersion;
    return focusElementAfterDomUpdate(selectTriggerElement);
  });

  $effect(() => {
    if (!mounted) {
      mounted = true;
      selectedValue = value;
      lastPropValue = value;
      lastEmittedValue = selectedValue;
      return;
    }
    if (selectedValue === lastEmittedValue) return;
    lastEmittedValue = selectedValue;
    selectBindings.changeHandler(selectChangeEvent(selectedValue));
  });

  $effect(() => {
    if (!mounted || value === lastPropValue) return;
    lastPropValue = value;
    selectedValue = value;
    lastEmittedValue = value;
  });
</script>

<div class={rootClassName} {hidden}>
  <Select.Root type="single" bind:value={selectedValue} {disabled}>
    <Select.Trigger
      bind:ref={selectTriggerElement}
      class={triggerClassName}
      aria-label={ariaLabel || title}
      {title}
      {disabled}
    >
      <span class="min-w-0 flex-1 truncate text-left">{selectedLabel}</span>
    </Select.Trigger>
    <Select.Content>
      <Select.Group>
        {#each optionRows as selectOptionRow (selectOptionRow.optionValue)}
          <Select.Item
            value={selectOptionRow.optionValue}
            label={selectOptionRow.optionLabel}
          >
            {selectOptionRow.optionLabel}
          </Select.Item>
        {/each}
      </Select.Group>
    </Select.Content>
  </Select.Root>
</div>

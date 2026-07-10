<script>
  import PlainSelectField from "./PlainSelectField.svelte";
  import { stringSelectOptionRows } from "../../lib/ui.js";

  let {
    value = "",
    optionValues = [],
    placeholderText = "",
    includeEmptyOption = false,
    "aria-label": ariaLabel = "",
    title = "",
    disabled = false,
    hidden = false,
    class: selectClass = "",
    onChange,
    onValueChange,
  } = $props();
  let plainOptionRows = $derived(
    stringSelectOptionRows(optionValues, {
      includeEmptyOption,
      placeholderText,
    }),
  );
</script>

<PlainSelectField
  class={selectClass}
  aria-label={ariaLabel || title || placeholderText}
  {title}
  {value}
  optionRows={plainOptionRows}
  {disabled}
  {hidden}
  {onChange}
  {onValueChange}
/>

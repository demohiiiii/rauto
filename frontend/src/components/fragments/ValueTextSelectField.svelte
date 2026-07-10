<script>
  import PlainSelectField from "./PlainSelectField.svelte";
  import { valueTextOptionRows } from "../../lib/ui.js";

  let {
    value = "",
    optionRows = [],
    placeholderText = "",
    "aria-label": ariaLabel = "",
    title = "",
    disabled = false,
    hidden = false,
    class: selectClass = "",
    onChange,
    onValueChange,
  } = $props();
  let plainOptionRows = $derived(valueTextOptionRows(optionRows));
</script>

<PlainSelectField
  class={selectClass}
  aria-label={ariaLabel || title}
  {title}
  {value}
  optionRows={plainOptionRows}
  {disabled}
  {hidden}
  {onChange}
  {onValueChange}
/>

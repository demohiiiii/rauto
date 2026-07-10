<script>
  import PlainSelectField from "./PlainSelectField.svelte";
  import { typeValueOptionRows } from "../../lib/ui.js";

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
  } = $props();
  let plainOptionRows = $derived(
    typeValueOptionRows(optionRows, placeholderText),
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
/>

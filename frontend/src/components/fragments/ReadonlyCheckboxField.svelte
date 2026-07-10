<script>
  import PlainCheckboxField from "./PlainCheckboxField.svelte";

  let {
    checked = false,
    labelText = "",
    class: labelClass = "",
    inputClass = "",
  } = $props();
</script>

<PlainCheckboxField
  class={labelClass}
  {inputClass}
  title={labelText}
  {labelText}
  {checked}
  disabled
/>

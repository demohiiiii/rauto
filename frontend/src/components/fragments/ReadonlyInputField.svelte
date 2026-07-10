<script>
  import PlainInputField from "./PlainInputField.svelte";

  let { value = "", placeholderText = "", class: inputClass = "" } = $props();
</script>

<PlainInputField
  class={inputClass}
  title={value}
  {value}
  {placeholderText}
  readonly
/>

<script lang="ts">
  import PlainCheckboxField from "./PlainCheckboxField.svelte";

  interface Props {
    checked?: boolean;
    class?: string;
    inputClass?: string;
    labelText?: string;
  }

  let {
    checked = false,
    labelText = "",
    class: labelClass = "",
    inputClass = "",
  }: Props = $props();
</script>

<PlainCheckboxField
  class={labelClass}
  {inputClass}
  title={labelText}
  {labelText}
  {checked}
  disabled
/>

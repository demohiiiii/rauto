<script lang="ts">
  import PlainTextAreaField from "./PlainTextAreaField.svelte";

  interface Props {
    "aria-label"?: string;
    class?: string;
    placeholderText?: string;
    value?: string;
  }

  let {
    value = "",
    placeholderText = "",
    "aria-label": ariaLabel = "",
    class: fieldClass = "min-h-24 font-mono",
  }: Props = $props();
</script>

<PlainTextAreaField
  class={fieldClass}
  aria-label={ariaLabel}
  title={value}
  {value}
  {placeholderText}
  readonly
/>

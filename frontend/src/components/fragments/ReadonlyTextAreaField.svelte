<script>
  import PlainTextAreaField from "./PlainTextAreaField.svelte";

  let {
    value = "",
    placeholderText = "",
    "aria-label": ariaLabel = "",
    class: fieldClass = "min-h-24 font-mono",
  } = $props();
</script>

<PlainTextAreaField
  class={fieldClass}
  aria-label={ariaLabel}
  title={value}
  {value}
  {placeholderText}
  readonly
/>

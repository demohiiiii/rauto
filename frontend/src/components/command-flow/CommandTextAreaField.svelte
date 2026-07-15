<script>
  import PlainTextAreaField from "../fragments/PlainTextAreaField.svelte";

  let {
    value = "",
    placeholderText = "",
    "aria-label": ariaLabel = "",
    disabled = false,
    onValueInput,
  } = $props();
</script>

<PlainTextAreaField
  class="min-h-20 resize-y font-mono leading-relaxed"
  aria-label={ariaLabel || placeholderText}
  {placeholderText}
  {value}
  {disabled}
  rows={3}
  {onValueInput}
/>

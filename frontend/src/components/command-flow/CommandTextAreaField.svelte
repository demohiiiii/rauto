<script lang="ts">
  import PlainTextAreaField from "../fragments/PlainTextAreaField.svelte";

  interface Props {
    "aria-label"?: string;
    disabled?: boolean;
    onValueInput?: (value: string) => void;
    placeholderText?: string;
    value?: string;
  }

  let {
    value = "",
    placeholderText = "",
    "aria-label": ariaLabel = "",
    disabled = false,
    onValueInput,
  }: Props = $props();
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

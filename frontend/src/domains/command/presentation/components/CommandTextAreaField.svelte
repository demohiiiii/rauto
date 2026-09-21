<script lang="ts">
  import PlainTextAreaField from "$components/fragments/PlainTextAreaField.svelte";

  interface Props {
    "aria-label"?: string;
    disabled?: boolean;
    readonly?: boolean;
    onValueInput?: (value: string) => void;
    placeholderText?: string;
    value?: string;
  }

  let {
    value = "",
    placeholderText = "",
    "aria-label": ariaLabel = "",
    disabled = false,
    readonly = false,
    onValueInput,
  }: Props = $props();
</script>

<PlainTextAreaField
  class="min-h-20 resize-y font-mono leading-relaxed"
  aria-label={ariaLabel || placeholderText}
  {placeholderText}
  {value}
  {disabled}
  {readonly}
  rows={3}
  {onValueInput}
/>

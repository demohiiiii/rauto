<script lang="ts">
  import PlainSelectField from "./PlainSelectField.svelte";
  import { stringSelectOptionRows } from "../../lib/ui.js";

  interface SelectChangeEvent {
    currentTarget: { value: string };
    target: { value: string };
  }

  interface Props {
    "aria-label"?: string;
    class?: string;
    disabled?: boolean;
    hidden?: boolean;
    includeEmptyOption?: boolean;
    onChange?: (event: SelectChangeEvent) => void;
    onValueChange?: (value: string) => void;
    optionValues?: string[];
    placeholderText?: string;
    title?: string;
    value?: string;
  }

  let {
    value = "",
    optionValues = [],
    placeholderText = "",
    includeEmptyOption = false,
    "aria-label": ariaLabel = "",
    title = "",
    disabled = false,
    hidden = false,
    class: selectClass = "",
    onChange,
    onValueChange,
  }: Props = $props();
  let plainOptionRows = $derived(
    stringSelectOptionRows(optionValues, {
      includeEmptyOption,
      placeholderText,
    }),
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
  {onValueChange}
/>

<script lang="ts">
  import PlainSelectField from "./PlainSelectField.svelte";
  import { valueLabelOptionRows } from "../../lib/ui.js";
  interface ValueLabelOption {
    label: string;
    value: string;
  }

  interface SelectChangeEvent {
    currentTarget: { value: string };
    target: { value: string };
  }

  interface ValueLabelSelectFieldProps {
    "aria-label"?: string;
    class?: string;
    disabled?: boolean;
    hidden?: boolean;
    onChange?: (event: SelectChangeEvent) => unknown;
    onValueChange?: (value: string) => unknown;
    optionRows?: ValueLabelOption[];
    title?: string;
    value?: string;
  }

  let {
    value = "",
    optionRows = [],
    "aria-label": ariaLabel = "",
    title = "",
    disabled = false,
    hidden = false,
    class: selectClass = "",
    onChange,
    onValueChange,
  }: ValueLabelSelectFieldProps = $props();
  let plainOptionRows = $derived(valueLabelOptionRows(optionRows));
</script>

<PlainSelectField
  class={selectClass}
  aria-label={ariaLabel || title}
  {title}
  {value}
  optionRows={plainOptionRows}
  {disabled}
  {hidden}
  {onChange}
  {onValueChange}
/>

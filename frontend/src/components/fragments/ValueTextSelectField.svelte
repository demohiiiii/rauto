<script lang="ts">
  import PlainSelectField from "./PlainSelectField.svelte";
  import { valueTextOptionRows } from "../../lib/ui.js";

  interface ValueTextOptionRow {
    labelText?: string;
    valueText?: string;
  }

  interface SelectChangeEvent {
    currentTarget: { value: string };
    target: { value: string };
  }

  interface Props {
    "aria-label"?: string;
    class?: string;
    disabled?: boolean;
    hidden?: boolean;
    onChange?: (event: SelectChangeEvent) => void;
    onValueChange?: (value: string) => void;
    optionRows?: readonly ValueTextOptionRow[];
    placeholderText?: string;
    title?: string;
    value?: string;
  }

  let {
    value = "",
    optionRows = [],
    placeholderText = "",
    "aria-label": ariaLabel = "",
    title = "",
    disabled = false,
    hidden = false,
    class: selectClass = "",
    onChange,
    onValueChange,
  }: Props = $props();
  let plainOptionRows = $derived(valueTextOptionRows(optionRows));
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

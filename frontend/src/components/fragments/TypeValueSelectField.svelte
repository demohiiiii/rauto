<script lang="ts">
  import PlainSelectField from "./PlainSelectField.svelte";
  import { typeValueOptionRows } from "../../lib/ui.js";

  interface TypeValueOptionRow {
    labelText: string;
    typeValue: string;
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
    onChange?: ((event: SelectChangeEvent) => void) | null;
    optionRows?: readonly TypeValueOptionRow[];
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
  }: Props = $props();
  let plainOptionRows = $derived(
    typeValueOptionRows(optionRows, placeholderText),
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
  onChange={onChange ?? undefined}
/>

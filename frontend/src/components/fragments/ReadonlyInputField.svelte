<script lang="ts">
  import PlainInputField from "./PlainInputField.svelte";
  import type { HTMLInputAttributes } from "svelte/elements";

  interface Props {
    class?: string;
    placeholderText?: string;
    value?: HTMLInputAttributes["value"];
  }

  let {
    value = "",
    placeholderText = "",
    class: inputClass = "",
  }: Props = $props();
  let title = $derived(String(value ?? ""));
</script>

<PlainInputField
  class={inputClass}
  {title}
  {value}
  {placeholderText}
  readonly
/>

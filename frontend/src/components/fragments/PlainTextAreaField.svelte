<script lang="ts">
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { textAreaFieldBindings } from "../../lib/events.js";
  import type { HTMLTextareaAttributes } from "svelte/elements";

  interface PlainTextAreaFieldProps {
    "aria-label"?: string;
    class?: string;
    disabled?: boolean;
    hidden?: boolean;
    id?: string;
    onInput?: HTMLTextareaAttributes["oninput"];
    onValueInput?: (value: string) => void;
    placeholderText?: string;
    readonly?: boolean;
    rows?: number;
    title?: string;
    value?: HTMLTextareaAttributes["value"];
  }

  type TextAreaFieldBindingsFactory = (options: {
    onInput?: HTMLTextareaAttributes["oninput"];
    onValueInput?: (value: string) => void;
  }) => { inputHandler: NonNullable<HTMLTextareaAttributes["oninput"]> };

  const createTextAreaFieldBindings =
    textAreaFieldBindings as unknown as TextAreaFieldBindingsFactory;

  let {
    value = "",
    id = undefined,
    placeholderText = "",
    "aria-label": ariaLabel = "",
    class: fieldClass = undefined,
    disabled = false,
    hidden = false,
    readonly = false,
    rows = undefined,
    title = "",
    onInput,
    onValueInput,
  }: PlainTextAreaFieldProps = $props();
  let areaBindings = $derived(
    createTextAreaFieldBindings({ onInput, onValueInput }),
  );
</script>

<Textarea
  {id}
  class={fieldClass}
  aria-label={ariaLabel || title || placeholderText}
  placeholder={placeholderText}
  {value}
  {title}
  {disabled}
  {hidden}
  {readonly}
  {rows}
  oninput={areaBindings.inputHandler}
/>

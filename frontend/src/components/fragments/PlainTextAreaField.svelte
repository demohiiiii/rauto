<script>
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { textAreaFieldBindings } from "../../lib/events.js";

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
  } = $props();
  let areaBindings = $derived(textAreaFieldBindings({ onInput, onValueInput }));
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

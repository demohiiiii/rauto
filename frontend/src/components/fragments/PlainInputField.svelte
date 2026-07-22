<script>
  import { Input } from "$lib/components/ui/input/index.js";
  import { focusElementAfterDomUpdate } from "../../lib/svelte.js";
  import { plainInputFieldBindings } from "../../lib/events.js";

  let {
    value = "",
    id = undefined,
    placeholderText = "",
    "aria-label": ariaLabel = "",
    title = "",
    type = "text",
    autocomplete = undefined,
    list = undefined,
    min = undefined,
    step = undefined,
    disabled = false,
    hidden = false,
    readonly = false,
    "focus-request-version": focusRequestVersion = 0,
    "select-on-focus-request": selectOnFocusRequest = false,
    class: inputClass = undefined,
    onInput,
    onValueInput,
    onFocus,
    onKeydown,
  } = $props();
  let inputBindings = $derived(
    plainInputFieldBindings({ onInput, onValueInput }),
  );
  let inputElement = $state(null);
  let lastFocusRequestVersion = $state(0);

  $effect(() => {
    if (
      !focusRequestVersion ||
      focusRequestVersion === lastFocusRequestVersion
    ) {
      return;
    }
    lastFocusRequestVersion = focusRequestVersion;
    return focusElementAfterDomUpdate(inputElement, {
      select: selectOnFocusRequest,
    });
  });
</script>

<Input
  bind:ref={inputElement}
  {id}
  class={inputClass}
  aria-label={ariaLabel || title || placeholderText}
  placeholder={placeholderText}
  {value}
  {title}
  {type}
  {autocomplete}
  {list}
  {min}
  {step}
  {disabled}
  {hidden}
  {readonly}
  oninput={inputBindings.inputHandler}
  onfocus={onFocus}
  onkeydown={onKeydown}
/>

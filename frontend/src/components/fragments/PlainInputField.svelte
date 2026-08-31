<script lang="ts">
  import { Input } from "$lib/components/ui/input/index.js";
  import { focusElementAfterDomUpdate } from "../../lib/svelte.js";
  import { plainInputFieldBindings } from "../../lib/events.js";
  import type { HTMLInputAttributes } from "svelte/elements";

  interface PlainInputFieldProps {
    "aria-label"?: string;
    autocomplete?: HTMLInputAttributes["autocomplete"];
    class?: string;
    disabled?: boolean;
    "focus-request-version"?: number;
    hidden?: boolean;
    id?: string;
    list?: string;
    min?: number | string;
    onFocus?: HTMLInputAttributes["onfocus"];
    onInput?: HTMLInputAttributes["oninput"];
    onKeydown?: HTMLInputAttributes["onkeydown"];
    onValueInput?: (value: string) => void;
    placeholderText?: string;
    readonly?: boolean;
    "select-on-focus-request"?: boolean;
    step?: number | string;
    title?: string;
    type?: HTMLInputAttributes["type"];
    value?: HTMLInputAttributes["value"];
  }

  type PlainInputBindingsFactory = (options: {
    onInput?: HTMLInputAttributes["oninput"];
    onValueInput?: (value: string) => void;
  }) => {
    inputHandler: NonNullable<HTMLInputAttributes["oninput"]>;
  };

  const createPlainInputFieldBindings =
    plainInputFieldBindings as unknown as PlainInputBindingsFactory;

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
  }: PlainInputFieldProps = $props();
  let inputBindings = $derived(
    createPlainInputFieldBindings({ onInput, onValueInput }),
  );
  let inputElement = $state<HTMLInputElement | null>(null);
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

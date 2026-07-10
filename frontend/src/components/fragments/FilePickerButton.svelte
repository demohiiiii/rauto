<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import { filePickerButtonBindings } from "../../lib/events.js";

  let {
    accept,
    "aria-label": ariaLabel,
    class: buttonClass = undefined,
    disabled,
    onFile,
    title,
    children,
    variant = "outline",
    size = "sm",
  } = $props();

  let inputElement = $state();
  let pickerBindings = $derived(filePickerButtonBindings({ onFile }));
</script>

<Button
  class={buttonClass}
  {variant}
  {size}
  type="button"
  {disabled}
  {title}
  aria-label={ariaLabel}
  onclick={pickerBindings.openPickerHandler(inputElement, disabled)}
>
  {@render children?.()}
</Button>
<input
  bind:this={inputElement}
  type="file"
  {accept}
  hidden
  onchange={pickerBindings.selectFile}
/>

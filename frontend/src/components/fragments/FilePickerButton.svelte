<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { filePickerButtonBindings } from "../../lib/events.js";
  import type { ComponentProps, Snippet } from "svelte";

  type ButtonProps = ComponentProps<typeof Button>;

  interface Props {
    accept?: string;
    "aria-label"?: string;
    children?: Snippet;
    class?: string;
    disabled?: boolean;
    onFile?: ((file: File | null) => Promise<void> | void) | null;
    size?: ButtonProps["size"];
    title?: string;
    variant?: ButtonProps["variant"];
  }

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
  }: Props = $props();

  let inputElement = $state<HTMLInputElement | null>(null);
  let pickerBindings = $derived(
    filePickerButtonBindings<Event>({ onFile: onFile ?? undefined }),
  );
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

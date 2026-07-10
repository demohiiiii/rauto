<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";

  let {
    class: buttonClass = undefined,
    type = "button",
    loading,
    disabled,
    title,
    "aria-label": ariaLabel,
    onclick,
    children,
    variant = "default",
    size = "sm",
  } = $props();

  let inactive = $derived(!!loading || !!disabled);
</script>

<Button
  class={buttonClass}
  {variant}
  {size}
  {type}
  disabled={inactive}
  aria-busy={loading ? "true" : undefined}
  {title}
  aria-label={ariaLabel}
  {onclick}
>
  {#if loading}
    <Spinner data-icon="inline-start" aria-hidden="true" aria-label={null} />
  {/if}
  {@render children?.()}
</Button>

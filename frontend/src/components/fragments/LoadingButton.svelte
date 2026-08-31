<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  type NativeLoadingButtonProps = Pick<
    HTMLButtonAttributes,
    | "aria-describedby"
    | "aria-label"
    | "disabled"
    | "onclick"
    | "title"
    | "type"
  >;

  type LoadingButtonProps = NativeLoadingButtonProps & {
    class?: string;
    children?: Snippet;
    loading?: boolean;
    size?:
      | "default"
      | "icon"
      | "icon-lg"
      | "icon-sm"
      | "icon-xs"
      | "lg"
      | "sm"
      | "xs";
    variant?:
      | "default"
      | "destructive"
      | "ghost"
      | "link"
      | "outline"
      | "primary-outline"
      | "secondary";
  };

  let {
    class: buttonClass = undefined,
    type = "button",
    loading = false,
    disabled = false,
    title = undefined,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedby,
    onclick,
    children,
    variant = "default",
    size = "sm",
  }: LoadingButtonProps = $props();

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
  aria-describedby={ariaDescribedby}
  {onclick}
>
  {#if loading}
    <Spinner data-icon="inline-start" aria-hidden="true" aria-label={null} />
  {/if}
  {@render children?.()}
</Button>

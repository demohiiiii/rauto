<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type AlertDescriptionProps = Omit<
    HTMLAttributes<HTMLDivElement>,
    "children"
  > & {
    children?: Snippet;
    ref?: HTMLDivElement | null;
  };

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: AlertDescriptionProps = $props();
</script>

<div
  bind:this={ref}
  data-slot="alert-description"
  class={cn(
    "text-muted-foreground text-sm text-balance md:text-pretty [&_p:not(:last-child)]:mb-4 [&_a]:hover:text-foreground [&_a]:underline [&_a]:underline-offset-3",
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</div>

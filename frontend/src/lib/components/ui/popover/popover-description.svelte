<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type PopoverDescriptionProps = Omit<
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
  }: PopoverDescriptionProps = $props();
</script>

<div
  bind:this={ref}
  data-slot="popover-description"
  class={cn("text-muted-foreground", className)}
  {...restProps}
>
  {@render children?.()}
</div>

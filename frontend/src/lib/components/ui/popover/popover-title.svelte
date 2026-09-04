<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type PopoverTitleProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
    children?: Snippet;
    ref?: HTMLDivElement | null;
  };

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: PopoverTitleProps = $props();
</script>

<div
  bind:this={ref}
  data-slot="popover-title"
  class={cn("font-medium", className)}
  {...restProps}
>
  {@render children?.()}
</div>

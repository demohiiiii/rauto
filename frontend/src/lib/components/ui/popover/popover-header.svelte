<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type PopoverHeaderProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
    children?: Snippet;
    ref?: HTMLDivElement | null;
  };

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: PopoverHeaderProps = $props();
</script>

<div
  bind:this={ref}
  data-slot="popover-header"
  class={cn("flex flex-col gap-1 text-sm", className)}
  {...restProps}
>
  {@render children?.()}
</div>

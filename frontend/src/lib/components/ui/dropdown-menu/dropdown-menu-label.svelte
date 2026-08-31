<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type DropdownMenuLabelProps = Omit<
    HTMLAttributes<HTMLDivElement>,
    "children"
  > & {
    children?: Snippet;
    inset?: boolean;
    ref?: HTMLDivElement | null;
  };
  let {
    ref = $bindable(null),
    class: className,
    inset,
    children,
    ...restProps
  }: DropdownMenuLabelProps = $props();
</script>

<div
  bind:this={ref}
  data-slot="dropdown-menu-label"
  data-inset={inset}
  class={cn(
    "text-muted-foreground px-2 py-1.5 text-xs font-medium data-inset:pl-8 data-[inset]:pl-8",
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</div>

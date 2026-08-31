<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { HTMLThAttributes } from "svelte/elements";

  type TableHeadProps = Omit<HTMLThAttributes, "children"> & {
    children?: Snippet;
    ref?: HTMLTableCellElement | null;
  };
  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: TableHeadProps = $props();
</script>

<th
  bind:this={ref}
  data-slot="table-head"
  class={cn(
    "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0",
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</th>

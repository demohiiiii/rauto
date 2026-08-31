<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { HTMLTdAttributes } from "svelte/elements";

  type TableCellProps = Omit<HTMLTdAttributes, "children"> & {
    children?: Snippet;
    ref?: HTMLTableCellElement | null;
  };
  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: TableCellProps = $props();
</script>

<td
  bind:this={ref}
  data-slot="table-cell"
  class={cn(
    "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</td>

<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type TableFooterProps = Omit<
    HTMLAttributes<HTMLTableSectionElement>,
    "children"
  > & {
    children?: Snippet;
    ref?: HTMLTableSectionElement | null;
  };

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: TableFooterProps = $props();
</script>

<tfoot
  bind:this={ref}
  data-slot="table-footer"
  class={cn(
    "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</tfoot>

<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type TableRowProps = Omit<HTMLAttributes<HTMLTableRowElement>, "children"> & {
    children?: Snippet;
    ref?: HTMLTableRowElement | null;
  };
  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: TableRowProps = $props();
</script>

<tr
  bind:this={ref}
  data-slot="table-row"
  class={cn(
    "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</tr>

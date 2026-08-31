<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { HTMLTableAttributes } from "svelte/elements";

  type TableProps = Omit<HTMLTableAttributes, "children"> & {
    children?: Snippet;
    ref?: HTMLTableElement | null;
  };

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: TableProps = $props();
</script>

<div data-slot="table-container" class="relative w-full overflow-x-auto">
  <table
    bind:this={ref}
    data-slot="table"
    class={cn("w-full caption-bottom text-sm", className)}
    {...restProps}
  >
    {@render children?.()}
  </table>
</div>

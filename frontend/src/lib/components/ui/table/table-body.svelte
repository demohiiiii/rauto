<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type TableBodyProps = Omit<
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
  }: TableBodyProps = $props();
</script>

<tbody
  bind:this={ref}
  data-slot="table-body"
  class={cn("[&_tr:last-child]:border-0", className)}
  {...restProps}
>
  {@render children?.()}
</tbody>

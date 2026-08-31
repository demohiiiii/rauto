<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type TableHeaderProps = Omit<
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
  }: TableHeaderProps = $props();
</script>

<thead
  bind:this={ref}
  data-slot="table-header"
  class={cn("[&_tr]:border-b", className)}
  {...restProps}
>
  {@render children?.()}
</thead>

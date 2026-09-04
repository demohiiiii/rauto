<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type SheetHeaderProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
    children?: Snippet;
    ref?: HTMLDivElement | null;
  };

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: SheetHeaderProps = $props();
</script>

<div
  bind:this={ref}
  data-slot="sheet-header"
  class={cn("gap-1.5 p-4 flex flex-col", className)}
  {...restProps}
>
  {@render children?.()}
</div>

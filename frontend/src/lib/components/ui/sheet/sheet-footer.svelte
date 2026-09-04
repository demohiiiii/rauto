<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type SheetFooterProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
    children?: Snippet;
    ref?: HTMLDivElement | null;
  };

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: SheetFooterProps = $props();
</script>

<div
  bind:this={ref}
  data-slot="sheet-footer"
  class={cn("gap-2 p-4 mt-auto flex flex-col", className)}
  {...restProps}
>
  {@render children?.()}
</div>

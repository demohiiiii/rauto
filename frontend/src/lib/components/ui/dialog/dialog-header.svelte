<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type DialogHeaderProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
    children?: Snippet;
    ref?: HTMLDivElement | null;
  };

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: DialogHeaderProps = $props();
</script>

<div
  bind:this={ref}
  data-slot="dialog-header"
  class={cn("gap-2 flex flex-col", className)}
  {...restProps}
>
  {@render children?.()}
</div>

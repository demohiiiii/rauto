<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type CardContentProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
    children?: Snippet;
    ref?: HTMLDivElement | null;
  };

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: CardContentProps = $props();
</script>

<div
  bind:this={ref}
  data-slot="card-content"
  class={cn("px-6 group-data-[size=sm]/card:px-4", className)}
  {...restProps}
>
  {@render children?.()}
</div>

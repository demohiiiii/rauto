<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type CardTitleProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
    children?: Snippet;
    ref?: HTMLDivElement | null;
  };

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: CardTitleProps = $props();
</script>

<div
  bind:this={ref}
  data-slot="card-title"
  class={cn(
    "text-base leading-normal font-medium group-data-[size=sm]/card:text-sm",
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</div>

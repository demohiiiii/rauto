<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type CardActionProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
    children?: Snippet;
    ref?: HTMLDivElement | null;
  };

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: CardActionProps = $props();
</script>

<div
  bind:this={ref}
  data-slot="card-action"
  class={cn(
    "cn-card-action col-start-2 row-span-2 row-start-1 self-start justify-self-end",
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</div>

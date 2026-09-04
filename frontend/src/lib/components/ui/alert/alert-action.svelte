<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type AlertActionProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
    children?: Snippet;
    ref?: HTMLDivElement | null;
  };

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: AlertActionProps = $props();
</script>

<div
  bind:this={ref}
  data-slot="alert-action"
  class={cn("absolute top-2.5 right-3", className)}
  {...restProps}
>
  {@render children?.()}
</div>

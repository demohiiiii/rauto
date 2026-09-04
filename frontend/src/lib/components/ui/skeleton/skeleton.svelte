<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { HTMLAttributes } from "svelte/elements";

  type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
    ref?: HTMLDivElement | null;
  };

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: SkeletonProps = $props();
</script>

<div
  bind:this={ref}
  data-slot="skeleton"
  class={cn("bg-muted rounded-md animate-pulse", className)}
  {...restProps}
></div>

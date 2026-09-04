<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type CalendarMonthProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
    children?: Snippet;
    ref?: HTMLDivElement | null;
  };

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: CalendarMonthProps = $props();
</script>

<div
  {...restProps}
  bind:this={ref}
  class={cn("flex w-full flex-col gap-4", className)}
>
  {@render children?.()}
</div>

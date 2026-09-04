<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type CalendarMonthsProps = Omit<
    HTMLAttributes<HTMLDivElement>,
    "children"
  > & {
    children?: Snippet;
    ref?: HTMLDivElement | null;
  };

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: CalendarMonthsProps = $props();
</script>

<div
  bind:this={ref}
  class={cn("relative flex flex-col gap-4 md:flex-row", className)}
  {...restProps}
>
  {@render children?.()}
</div>

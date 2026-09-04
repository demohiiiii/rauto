<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type CalendarNavProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
    children?: Snippet;
    ref?: HTMLElement | null;
  };

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: CalendarNavProps = $props();
</script>

<nav
  {...restProps}
  bind:this={ref}
  class={cn(
    "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
    className,
  )}
>
  {@render children?.()}
</nav>

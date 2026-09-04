<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type TableCaptionProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
    children?: Snippet;
    ref?: HTMLTableCaptionElement | null;
  };

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: TableCaptionProps = $props();
</script>

<caption
  bind:this={ref}
  data-slot="table-caption"
  class={cn("text-muted-foreground mt-4 text-sm", className)}
  {...restProps}
>
  {@render children?.()}
</caption>

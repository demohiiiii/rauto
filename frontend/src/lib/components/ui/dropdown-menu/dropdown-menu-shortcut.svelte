<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type DropdownMenuShortcutProps = Omit<
    HTMLAttributes<HTMLSpanElement>,
    "children"
  > & {
    children?: Snippet;
    ref?: HTMLSpanElement | null;
  };

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: DropdownMenuShortcutProps = $props();
</script>

<span
  bind:this={ref}
  data-slot="dropdown-menu-shortcut"
  class={cn(
    "text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground ml-auto text-xs tracking-widest",
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</span>

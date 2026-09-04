<script lang="ts">
  import { Separator } from "$lib/components/ui/separator/index.js";
  import { cn } from "$lib/utils.js";
  import type { ComponentProps } from "svelte";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: ComponentProps<typeof Separator> = $props();
</script>

<Separator
  bind:ref
  data-slot="select-separator"
  class={cn("bg-border -mx-1 my-1 h-px pointer-events-none", className)}
  {...restProps}
/>

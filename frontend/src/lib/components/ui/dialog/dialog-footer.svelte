<script lang="ts">
  import { cn } from "$lib/utils.js";
  import { Dialog as DialogPrimitive } from "bits-ui";
  import { Button } from "$lib/components/ui/button/index.js";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type DialogFooterProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
    children?: Snippet;
    ref?: HTMLDivElement | null;
    showCloseButton?: boolean;
  };

  let {
    ref = $bindable(null),
    class: className,
    children,
    showCloseButton = false,
    ...restProps
  }: DialogFooterProps = $props();
</script>

<div
  bind:this={ref}
  data-slot="dialog-footer"
  class={cn(
    "gap-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
    className,
  )}
  {...restProps}
>
  {@render children?.()}
  {#if showCloseButton}
    <DialogPrimitive.Close>
      {#snippet child({ props })}
        <Button variant="outline" {...props}>Close</Button>
      {/snippet}
    </DialogPrimitive.Close>
  {/if}
</div>

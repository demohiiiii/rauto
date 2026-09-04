<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
  import { cn } from "$lib/utils.js";

  type DropdownMenuGroupHeadingProps =
    DropdownMenuPrimitive.GroupHeadingProps & {
      inset?: boolean;
    };

  let {
    ref = $bindable(null),
    class: className,
    inset,
    ...restProps
  }: DropdownMenuGroupHeadingProps = $props();
</script>

<DropdownMenuPrimitive.GroupHeading
  bind:ref
  data-slot="dropdown-menu-group-heading"
  data-inset={inset}
  class={cn("px-2 py-1.5 text-sm font-semibold data-[inset]:ps-8", className)}
  {...restProps}
/>

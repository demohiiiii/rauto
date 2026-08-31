<script module lang="ts">
  import { getContext, setContext } from "svelte";
  import { toggleVariants } from "$lib/components/ui/toggle/index.js";
  import type { VariantProps } from "tailwind-variants";

  export type ToggleGroupContext = VariantProps<typeof toggleVariants> & {
    orientation: "horizontal" | "vertical";
    spacing: number;
  };

  export function setToggleGroupCtx(props: ToggleGroupContext): void {
    setContext("toggleGroup", props);
  }

  export function getToggleGroupCtx(): ToggleGroupContext {
    return getContext<ToggleGroupContext>("toggleGroup");
  }
</script>

<script lang="ts">
  import { ToggleGroup as ToggleGroupPrimitive } from "bits-ui";
  import { cn } from "$lib/utils.js";

  type ToggleGroupProps = ToggleGroupPrimitive.RootProps &
    VariantProps<typeof toggleVariants> & {
      spacing?: number;
    };

  let {
    ref = $bindable(null),
    value = $bindable(),
    class: className,
    size = "default",
    spacing = 0,
    orientation = "horizontal",
    variant = "default",
    ...restProps
  }: ToggleGroupProps = $props();

  setToggleGroupCtx({
    get variant() {
      return variant;
    },
    get size() {
      return size;
    },
    get spacing() {
      return spacing;
    },
    get orientation() {
      return orientation;
    },
  });
</script>

<!--
Discriminated Unions + Destructing (required for bindable) do not
get along, so we shut typescript up by casting `value` to `never`.
-->
<ToggleGroupPrimitive.Root
  bind:value={value as never}
  bind:ref
  {orientation}
  data-slot="toggle-group"
  data-variant={variant}
  data-size={size}
  data-spacing={spacing}
  style={`--gap: ${spacing}`}
  class={cn(
    "rounded-md data-[spacing=0]:data-[variant=outline]:shadow-xs group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] data-vertical:flex-col data-vertical:items-stretch",
    className,
  )}
  {...restProps}
/>

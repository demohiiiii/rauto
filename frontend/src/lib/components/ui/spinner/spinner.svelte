<script lang="ts">
  import { cn } from "$lib/utils.js";
  import Loader2Icon from "@lucide/svelte/icons/loader-2";
  import type { LucideProps } from "@lucide/svelte";

  type SpinnerProps = Omit<
    LucideProps,
    "aria-label" | "class" | "color" | "name" | "stroke"
  > & {
    "aria-label"?: string | null;
    class?: string;
    color?: string | null;
    name?: string | null;
    stroke?: string | null;
  };

  let {
    class: className,
    role = "status",
    // we add name, color, and stroke for compatibility with different icon libraries props
    name = undefined,
    color = undefined,
    stroke = undefined,
    "aria-label": ariaLabel = "Loading",
    ...restProps
  }: SpinnerProps = $props();
</script>

<Loader2Icon
  {role}
  name={name === null ? undefined : name}
  color={color === null ? undefined : color}
  stroke={stroke === null ? undefined : stroke}
  aria-label={ariaLabel}
  class={cn("size-4 animate-spin", className)}
  {...restProps}
/>

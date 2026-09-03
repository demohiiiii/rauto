<script lang="ts">
  import type { Snippet } from "svelte";
  import FileInputIcon from "@lucide/svelte/icons/file-input";
  import CommandFlowSurface from "./CommandFlowSurface.svelte";

  type SurfaceVariant = "section" | "workbench-header" | "workbench-section";

  interface Props {
    actions?: Snippet;
    children?: Snippet;
    class?: string;
    description?: string;
    indexText?: string;
    surfaceVariant?: SurfaceVariant;
    title?: string;
  }

  let {
    actions,
    children,
    class: className = "",
    description = "",
    indexText = "",
    surfaceVariant = "section",
    title = "",
  }: Props = $props();
</script>

<CommandFlowSurface
  class={className}
  icon={FileInputIcon}
  {indexText}
  {title}
  {description}
  {actions}
  variant={surfaceVariant}
>
  {@render children?.()}
</CommandFlowSurface>

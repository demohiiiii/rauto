<script>
  import FileInputIcon from "@lucide/svelte/icons/file-input";
  import CommandFlowSurface from "./CommandFlowSurface.svelte";

  let {
    actions,
    children,
    class: className = "",
    description = "",
    indexText = "",
    surfaceVariant = "section",
    title = "",
  } = $props();
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

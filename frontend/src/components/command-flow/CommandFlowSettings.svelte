<script>
  import SlidersHorizontalIcon from "@lucide/svelte/icons/sliders-horizontal";
  import PresenceFieldGrid from "../fragments/PresenceFieldGrid.svelte";
  import CommandFlowSurface from "./CommandFlowSurface.svelte";

  let {
    children,
    description = "",
    fieldRows = [],
    indexText = "",
    metadataFieldRows = [],
    onMetadataPresenceChangeForKey,
    onMetadataValueChangeForKey,
    onPresenceChangeForKey,
    onValueChangeForKey,
    surfaceVariant = "section",
    title = "",
  } = $props();
</script>

<CommandFlowSurface
  icon={SlidersHorizontalIcon}
  {indexText}
  {title}
  {description}
  variant={surfaceVariant}
>
  {#if fieldRows.length > 0}
    <PresenceFieldGrid
      {fieldRows}
      valueHandlerMode="event"
      hostClass="grid gap-3 md:grid-cols-2"
      presenceControlsMode="hidden"
      {onValueChangeForKey}
      {onPresenceChangeForKey}
    />
  {/if}
  {#if metadataFieldRows.length > 0}
    <PresenceFieldGrid
      fieldRows={metadataFieldRows}
      valueHandlerMode="event"
      hostClass="grid gap-3 md:grid-cols-2"
      presenceControlsMode="hidden"
      onValueChangeForKey={onMetadataValueChangeForKey}
      onPresenceChangeForKey={onMetadataPresenceChangeForKey}
    />
  {/if}
  {@render children?.()}
</CommandFlowSurface>

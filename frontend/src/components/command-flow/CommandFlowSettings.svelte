<script lang="ts">
  import type { Snippet } from "svelte";
  import SlidersHorizontalIcon from "@lucide/svelte/icons/sliders-horizontal";
  import PresenceFieldGrid from "../fragments/PresenceFieldGrid.svelte";
  import type {
    PresenceFieldPresenceHandlerForKey,
    PresenceFieldRow,
    PresenceFieldValueHandlerForKey,
  } from "../fragments/presenceFieldTypes.js";
  import CommandFlowSurface from "./CommandFlowSurface.svelte";

  type SurfaceVariant = "section" | "workbench-header" | "workbench-section";

  interface Props {
    children?: Snippet;
    description?: string;
    fieldRows?: PresenceFieldRow[];
    indexText?: string;
    metadataFieldRows?: PresenceFieldRow[];
    onMetadataPresenceChangeForKey?: PresenceFieldPresenceHandlerForKey | null;
    onMetadataValueChangeForKey?: PresenceFieldValueHandlerForKey | null;
    onPresenceChangeForKey?: PresenceFieldPresenceHandlerForKey | null;
    onValueChangeForKey?: PresenceFieldValueHandlerForKey | null;
    surfaceVariant?: SurfaceVariant;
    title?: string;
  }

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
  }: Props = $props();
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

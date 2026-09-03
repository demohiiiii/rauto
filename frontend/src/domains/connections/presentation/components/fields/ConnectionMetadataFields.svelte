<script lang="ts">
  import type { ConnectionVarsState } from "$domains/connections/index.js";
  import ConnectionPickerField from "./ConnectionPickerField.svelte";
  import ConnectionVarsField from "./ConnectionVarsField.svelte";

  interface PickerDisplay {
    labelText: string;
    pickerPlaceholder: string;
  }

  interface MetadataFieldsDisplay {
    groupsPicker: PickerDisplay;
    labelsPicker: PickerDisplay;
  }

  type MetadataValues = string[] | ConnectionVarsState["connectionVars"];

  interface Props {
    active?: boolean;
    groupsPickerKey: string;
    labelsPickerKey: string;
    metadataFieldsDisplay: MetadataFieldsDisplay;
    onMetadataChange?: (metadataValues: MetadataValues) => void;
    showPickers?: boolean;
    showVars?: boolean;
    varsKey: string;
  }

  let {
    active = true,
    groupsPickerKey,
    labelsPickerKey,
    metadataFieldsDisplay,
    onMetadataChange,
    showPickers = true,
    showVars = true,
    varsKey,
  }: Props = $props();
  const forwardMetadataChange = (metadataValues: MetadataValues): void => {
    if (active) onMetadataChange?.(metadataValues);
  };
</script>

{#if showPickers}
  <div class="grid gap-3 md:grid-cols-2">
    <ConnectionPickerField
      {active}
      keyName={labelsPickerKey}
      labelText={metadataFieldsDisplay.labelsPicker.labelText}
      onSelectionChange={forwardMetadataChange}
      pickerPlaceholder={metadataFieldsDisplay.labelsPicker.pickerPlaceholder}
    />
    <ConnectionPickerField
      {active}
      keyName={groupsPickerKey}
      labelText={metadataFieldsDisplay.groupsPicker.labelText}
      onSelectionChange={forwardMetadataChange}
      pickerPlaceholder={metadataFieldsDisplay.groupsPicker.pickerPlaceholder}
    />
  </div>
{/if}
{#if showVars}
  <ConnectionVarsField
    {active}
    keyName={varsKey}
    labelTextKey="inventoryFieldVars"
    onVarsChange={forwardMetadataChange}
  />
{/if}

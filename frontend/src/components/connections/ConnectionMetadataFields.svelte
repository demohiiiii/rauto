<script>
  import ConnectionPickerField from "./ConnectionPickerField.svelte";
  import ConnectionVarsField from "./ConnectionVarsField.svelte";

  let {
    active,
    groupsPickerKey,
    labelsPickerKey,
    metadataFieldsDisplay,
    onMetadataChange,
    showPickers = true,
    showVars = true,
    varsKey,
  } = $props();
  const forwardMetadataChange = (metadataValues) =>
    active && typeof onMetadataChange === "function"
      ? onMetadataChange(metadataValues)
      : undefined;
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

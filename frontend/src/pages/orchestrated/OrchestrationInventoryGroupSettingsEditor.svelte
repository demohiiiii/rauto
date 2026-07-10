<script>
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PlainCheckboxField from "../../components/fragments/PlainCheckboxField.svelte";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import PresenceToggle from "../../components/fragments/PresenceToggle.svelte";
  import { createOrchestrationInventoryGroupSettingsEditorWorkspace } from "../../modules/orchestrationInventoryState.js";

  let { model, groupRow, inventoryDisplay, onChange, onErrorChange } = $props();
  const orchestrationInventoryGroupSettingsEditorWorkspace =
    createOrchestrationInventoryGroupSettingsEditorWorkspace();
  const {
    groupSettingsCallbacksStateStore,
    groupSettingsDisplayStateStore,
    setInventoryGroupSettingsContext,
  } = orchestrationInventoryGroupSettingsEditorWorkspace;
  let groupSettingsCallbacks = $derived($groupSettingsCallbacksStateStore);
  let groupSettingsDisplay = $derived($groupSettingsDisplayStateStore);

  $effect(() => {
    setInventoryGroupSettingsContext({
      groupRow,
      inventoryDisplay,
      model,
      onChange,
      onErrorChange,
    });
  });
</script>

<div class="grid gap-3 md:grid-cols-2">
  <label class="flex flex-col gap-2">
    <span class="text-sm font-medium text-foreground">
      {groupSettingsDisplay.nameField.labelText}
    </span>
    <PlainInputField
      value={groupSettingsDisplay.nameField.valueText}
      onValueInput={groupSettingsCallbacks.nameValueHandler()}
    />
  </label>
  <PlainCheckboxField
    class="cursor-pointer justify-start gap-2 self-end"
    controlKind="switch"
    checked={groupSettingsDisplay.useDetailedChecked}
    labelText={groupSettingsDisplay.useDetailedLabelText}
    onCheckedChange={groupSettingsCallbacks.useDetailedCheckedHandler()}
  />
  <div class="flex flex-col gap-2 md:col-span-2">
    <div class="mb-1 flex items-center justify-between gap-3">
      <span class="text-sm font-medium text-foreground"
        >{groupSettingsDisplay.defaultsVarsField.labelText}</span
      >
      <PresenceToggle
        checked={groupSettingsDisplay.defaultsVarsField.enabled}
        onCheckedChange={groupSettingsCallbacks.defaultsVarsPresenceHandler()}
      />
    </div>
    {#if groupSettingsDisplay.defaultsVarsField.enabled}
      <JsonObjectFieldsEditor
        title={groupSettingsDisplay.defaultsVarsField.labelText}
        source={groupSettingsDisplay.defaultsVarsField.source}
        typeRows={inventoryDisplay.jsonValueTypeRows}
        onChange={groupSettingsCallbacks.setDefaultsVars}
      />
    {/if}
  </div>
  <PresenceFieldGrid
    fieldRows={groupSettingsDisplay.defaultsFieldRows}
    hostClass="contents"
    onValueChangeForKey={groupSettingsCallbacks.defaultFieldValueHandler}
    onNullableModeChangeForKey={groupSettingsCallbacks.defaultFieldNullableModeHandler}
    onPresenceChangeForKey={groupSettingsCallbacks.defaultFieldPresenceHandler}
  />
  <PresenceFieldGrid
    fieldRows={groupSettingsDisplay.defaultsMetadataFieldRows}
    hostClass="contents"
    showPresenceToggleFallback={true}
    onValueChangeForKey={groupSettingsCallbacks.defaultsMetadataValueHandler}
    onPresenceChangeForKey={groupSettingsCallbacks.defaultsMetadataPresenceHandler}
  />
  <PresenceFieldGrid
    fieldRows={groupSettingsDisplay.groupMetadataFieldRows}
    hostClass="contents"
    showPresenceToggleFallback={true}
    onValueChangeForKey={groupSettingsCallbacks.groupMetadataValueHandler}
    onPresenceChangeForKey={groupSettingsCallbacks.groupMetadataPresenceHandler}
  />

  <JsonObjectFieldsEditor
    title={groupSettingsDisplay.defaultsExtraField.titleText}
    source={groupSettingsDisplay.defaultsExtraField.source}
    typeRows={groupSettingsDisplay.defaultsExtraField.typeRows}
    onChange={groupSettingsCallbacks.setDefaultsExtra}
  />
  <JsonObjectFieldsEditor
    title={groupSettingsDisplay.groupExtraField.titleText}
    source={groupSettingsDisplay.groupExtraField.source}
    typeRows={groupSettingsDisplay.groupExtraField.typeRows}
    onChange={groupSettingsCallbacks.setGroupExtra}
  />
</div>

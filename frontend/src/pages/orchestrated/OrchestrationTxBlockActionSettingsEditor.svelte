<script>
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import { createOrchestrationTxBlockActionSettingsEditorWorkspace } from "../../modules/orchestrationTxBlockActionEditors.js";

  let {
    txBlock,
    txBlockRows,
    visualDisplay,
    onSourceChange,
    onNameInput,
    onSetFieldPresence,
    onExtraChange,
  } = $props();
  const orchestrationTxBlockActionSettingsEditorWorkspace =
    createOrchestrationTxBlockActionSettingsEditorWorkspace();
  const {
    settingsCallbacksStateStore,
    settingsPanelDisplayStateStore,
    setTxBlockActionSettingsContext,
  } = orchestrationTxBlockActionSettingsEditorWorkspace;
  let settingsCallbacks = $derived($settingsCallbacksStateStore);
  let settingsPanelDisplay = $derived($settingsPanelDisplayStateStore);

  $effect(() => {
    setTxBlockActionSettingsContext({
      onExtraChange,
      onSetFieldPresence,
      txBlock,
      visualDisplay,
    });
  });
</script>

<div class="md:col-span-2">
  <PresenceFieldGrid
    fieldRows={[settingsPanelDisplay.settingsDisplay.sourceField]}
    hostClass="contents"
    onValueChange={onSourceChange}
  />
</div>

<PresenceFieldGrid
  fieldRows={[settingsPanelDisplay.settingsDisplay.nameField]}
  hostClass="contents"
  onValueChange={onNameInput}
  onPresenceChange={settingsCallbacks.namePresenceHandler}
/>

<PresenceFieldGrid
  fieldRows={settingsPanelDisplay.metadataFieldRows}
  hostClass="contents"
  onValueChangeForKey={settingsCallbacks.metadataValueHandler}
  onPresenceChangeForKey={settingsCallbacks.metadataPresenceHandler}
/>

<JsonObjectFieldsEditor
  title={settingsPanelDisplay.extraField.titleText}
  source={settingsPanelDisplay.extraField.source}
  typeRows={settingsPanelDisplay.extraField.typeRows}
  onChange={onExtraChange}
/>

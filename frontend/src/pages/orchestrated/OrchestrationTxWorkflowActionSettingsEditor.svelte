<script>
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import { createOrchestrationTxWorkflowActionSettingsEditorWorkspace } from "../../modules/orchestrationTxWorkflowActions.js";

  let {
    txWorkflow,
    txWorkflowRows,
    visualDisplay,
    onSourceChange,
    onExtraChange,
  } = $props();
  const orchestrationTxWorkflowActionSettingsEditorWorkspace =
    createOrchestrationTxWorkflowActionSettingsEditorWorkspace();
  const {
    settingsCallbacksStateStore,
    settingsPanelDisplayStateStore,
    setTxWorkflowActionSettingsContext,
  } = orchestrationTxWorkflowActionSettingsEditorWorkspace;
  let settingsCallbacks = $derived($settingsCallbacksStateStore);
  let settingsPanelDisplay = $derived($settingsPanelDisplayStateStore);

  $effect(() => {
    setTxWorkflowActionSettingsContext({
      onExtraChange,
      txWorkflow,
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

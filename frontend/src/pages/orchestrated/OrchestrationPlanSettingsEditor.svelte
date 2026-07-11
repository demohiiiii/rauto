<script>
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import { createOrchestrationPlanSettingsEditorWorkspace } from "../../modules/orchestrationStageEditorsState.js";

  let { model, visualDisplay, onChange } = $props();
  const orchestrationPlanSettingsEditorWorkspace =
    createOrchestrationPlanSettingsEditorWorkspace();
  const {
    planSettingsCallbacksStateStore,
    settingsPanelDisplayStateStore,
    setPlanSettingsContext,
  } = orchestrationPlanSettingsEditorWorkspace;
  let settingsPanelDisplay = $derived($settingsPanelDisplayStateStore);
  let planSettingsCallbacks = $derived($planSettingsCallbacksStateStore);

  $effect(() => {
    setPlanSettingsContext({ model, onChange, visualDisplay });
  });
</script>

<div class="grid gap-4">
  <div class="grid gap-3 md:grid-cols-2">
    <PresenceFieldGrid
      fieldRows={settingsPanelDisplay.rootFieldRows}
      hostClass="contents"
      itemClassByFieldKey={{ inventoryFile: "md:col-span-2" }}
      onValueChangeForKey={planSettingsCallbacks.fieldValueHandler}
      onNullableModeChangeForKey={planSettingsCallbacks.fieldNullableModeHandler}
      onPresenceChangeForKey={planSettingsCallbacks.fieldPresenceHandler}
    />
    <PresenceFieldGrid
      fieldRows={settingsPanelDisplay.metadataFieldRows}
      hostClass="contents"
      onValueChangeForKey={planSettingsCallbacks.metadataValueHandler}
      onPresenceChangeForKey={planSettingsCallbacks.metadataPresenceHandler}
    />
  </div>

  <JsonObjectFieldsEditor
    title={settingsPanelDisplay.extraField.titleText}
    source={settingsPanelDisplay.extraField.source}
    typeRows={settingsPanelDisplay.extraField.typeRows}
    onChange={planSettingsCallbacks.setExtra}
  />
</div>

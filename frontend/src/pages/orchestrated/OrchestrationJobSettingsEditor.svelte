<script>
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import { createOrchestrationJobSettingsEditorWorkspace } from "../../modules/orchestrationStageState.js";

  let { model, stageIndex, jobIndex, job, visualDisplay, onChange } = $props();
  const orchestrationJobSettingsEditorWorkspace =
    createOrchestrationJobSettingsEditorWorkspace();
  const {
    jobSettingsCallbacksStateStore,
    settingsPanelDisplayStateStore,
    setJobSettingsContext,
  } = orchestrationJobSettingsEditorWorkspace;
  let settingsPanelDisplay = $derived($settingsPanelDisplayStateStore);
  let jobSettingsCallbacks = $derived($jobSettingsCallbacksStateStore);

  $effect(() => {
    setJobSettingsContext({
      job,
      jobIndex,
      model,
      onChange,
      stageIndex,
      visualDisplay,
    });
  });
</script>

<div class="grid gap-3">
  <div class="grid gap-3 md:grid-cols-2">
    <PresenceFieldGrid
      fieldRows={settingsPanelDisplay.fieldRows}
      hostClass="contents"
      onValueChangeForKey={jobSettingsCallbacks.fieldValueHandler}
      onNullableModeChangeForKey={jobSettingsCallbacks.fieldNullableModeHandler}
      onPresenceChangeForKey={jobSettingsCallbacks.fieldPresenceHandler}
    />
    <PresenceFieldGrid
      fieldRows={settingsPanelDisplay.metadataFieldRows}
      hostClass="contents"
      onValueChangeForKey={jobSettingsCallbacks.metadataValueHandler}
      onPresenceChangeForKey={jobSettingsCallbacks.metadataPresenceHandler}
    />
  </div>

  <JsonObjectFieldsEditor
    title={settingsPanelDisplay.extraField.titleText}
    source={settingsPanelDisplay.extraField.source}
    typeRows={settingsPanelDisplay.extraField.typeRows}
    onChange={jobSettingsCallbacks.setExtra}
  />
</div>

<script>
  import ConnectionPickerField from "../../components/connections/ConnectionPickerField.svelte";
  import {
    CONNECTION_PICKER,
    setConnectionPickerSelectedValues,
  } from "../../modules/connectionFields.js";
  import { createOrchestrationJobTargetsEditorWorkspace } from "../../modules/orchestrationStageTargetsState.js";

  let { jobRow, onReplaceStringList } = $props();
  const jobTargetsWorkspace = createOrchestrationJobTargetsEditorWorkspace();
  let jobTargetsDisplayStateStore = $derived(
    jobTargetsWorkspace.jobTargetsDisplayStateStore,
  );
  let targetActionHandlersStateStore = $derived(
    jobTargetsWorkspace.targetActionHandlersStateStore,
  );
  const { setJobTargetsContext } = jobTargetsWorkspace;
  let jobTargetsDisplay = $derived($jobTargetsDisplayStateStore);
  let targetActionHandlers = $derived($targetActionHandlersStateStore);

  $effect(() => {
    setJobTargetsContext({ jobRow, onReplaceStringList });
  });

  $effect(() => {
    setConnectionPickerSelectedValues(
      CONNECTION_PICKER.orchestrationTargetGroups,
      jobRow?.job?.targetGroups || [],
    );
    setConnectionPickerSelectedValues(
      CONNECTION_PICKER.orchestrationTargetTags,
      jobRow?.job?.targetTags || [],
    );
    setConnectionPickerSelectedValues(
      CONNECTION_PICKER.orchestrationTargets,
      jobRow?.job?.targets || [],
    );
  });
</script>

<div class="@container min-w-0">
  <div class="grid min-w-0 gap-3 @2xl:grid-cols-3">
    <ConnectionPickerField
      keyName={CONNECTION_PICKER.orchestrationTargetGroups}
      labelText={jobTargetsDisplay.targetGroupsField.labelText}
      pickerPlaceholder={jobTargetsDisplay.targetGroupsField.placeholderText}
      onSelectionChange={targetActionHandlers.replaceStringListHandler(
        "targetGroups",
      )}
    />

    <ConnectionPickerField
      keyName={CONNECTION_PICKER.orchestrationTargetTags}
      labelText={jobTargetsDisplay.targetTagsField.labelText}
      pickerPlaceholder={jobTargetsDisplay.targetTagsField.placeholderText}
      onSelectionChange={targetActionHandlers.replaceStringListHandler(
        "targetTags",
      )}
    />

    <ConnectionPickerField
      keyName={CONNECTION_PICKER.orchestrationTargets}
      labelText={jobTargetsDisplay.targetsField.labelText}
      pickerPlaceholder={jobTargetsDisplay.targetsField.placeholderText}
      onSelectionChange={targetActionHandlers.replaceStringListHandler(
        "targets",
      )}
    />
  </div>
</div>

<script lang="ts">
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import { createOrchestrationJobSettingsEditorWorkspace } from "$domains/orchestration/index.js";
  import type {
    OrchestrationJobModel,
    OrchestrationPlanChangeHandler,
    OrchestrationPlanFormModel,
    OrchestrationVisualEditorDisplay,
  } from "$domains/orchestration/index.js";

  interface Props {
    job: OrchestrationJobModel;
    jobIndex: number;
    model: OrchestrationPlanFormModel;
    onChange?: OrchestrationPlanChangeHandler | null;
    stageIndex: number;
    visualDisplay: OrchestrationVisualEditorDisplay;
  }

  let {
    model,
    stageIndex,
    jobIndex,
    job,
    visualDisplay,
    onChange = null,
  }: Props = $props();
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
      presenceControlsMode="hidden"
      onValueChangeForKey={jobSettingsCallbacks.fieldValueHandler}
    />
  </div>
</div>

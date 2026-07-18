<script>
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import { createOrchestrationTxWorkflowActionSettingsEditorWorkspace } from "../../modules/orchestrationTxWorkflowActions.js";

  let { txWorkflow, visualDisplay, onSourceChange } = $props();
  const orchestrationTxWorkflowActionSettingsEditorWorkspace =
    createOrchestrationTxWorkflowActionSettingsEditorWorkspace();
  const { settingsPanelDisplayStateStore, setTxWorkflowActionSettingsContext } =
    orchestrationTxWorkflowActionSettingsEditorWorkspace;
  let settingsPanelDisplay = $derived($settingsPanelDisplayStateStore);

  $effect(() => {
    setTxWorkflowActionSettingsContext({
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

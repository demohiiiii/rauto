<script lang="ts">
  import PresenceFieldGrid from "$components/fragments/PresenceFieldGrid.svelte";
  import { createOrchestrationTxWorkflowActionSettingsEditorWorkspace } from "$domains/orchestration/index.js";
  import { formValue } from "$lib/events.js";
  import type {
    OrchestrationTxWorkflowActionModel,
    OrchestrationVisualEditorDisplay,
  } from "$domains/orchestration/index.js";
  import type { PresenceFieldValueInput } from "$components/fragments/presenceFieldTypes.js";

  interface Props {
    onSourceChange?: ((sourceValue: string) => void) | null;
    txWorkflow: OrchestrationTxWorkflowActionModel;
    visualDisplay: OrchestrationVisualEditorDisplay;
  }

  let { txWorkflow, visualDisplay, onSourceChange = null }: Props = $props();
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

  function changeSource(input: PresenceFieldValueInput): void {
    onSourceChange?.(typeof input === "string" ? input : formValue(input));
  }
</script>

<div class="md:col-span-2">
  <PresenceFieldGrid
    fieldRows={[settingsPanelDisplay.settingsDisplay.sourceField]}
    hostClass="contents"
    onValueChange={changeSource}
  />
</div>

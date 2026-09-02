<script lang="ts">
  import OrchestrationTxWorkflowActionEditor from "$domains/orchestration/presentation/components/editor/OrchestrationTxWorkflowActionEditor.svelte";
  import type {
    OrchestrationErrorChangeHandler,
    OrchestrationJobEditorRow,
    OrchestrationPlanChangeHandler,
    OrchestrationPlanFormModel,
    OrchestrationVisualEditorDisplay,
  } from "$domains/orchestration/index.js";

  interface Props {
    jobIndex: number;
    jobRow: OrchestrationJobEditorRow;
    model: OrchestrationPlanFormModel;
    onChange?: OrchestrationPlanChangeHandler | null;
    onErrorChange?: OrchestrationErrorChangeHandler | null;
    stageIndex: number;
    visualDisplay: OrchestrationVisualEditorDisplay;
  }

  let {
    model,
    stageIndex,
    jobIndex,
    jobRow,
    visualDisplay,
    onChange = null,
    onErrorChange = null,
  }: Props = $props();
</script>

<OrchestrationTxWorkflowActionEditor
  {model}
  {stageIndex}
  {jobIndex}
  {jobRow}
  {visualDisplay}
  {onChange}
  {onErrorChange}
  settingsOnly={true}
/>

<script lang="ts">
  import OrchestrationFlowCanvas from "$domains/orchestration/presentation/components/canvas/OrchestrationFlowCanvas.svelte";
  import type {
    OrchestrationEditorView,
    OrchestrationErrorChangeHandler,
    OrchestrationPlanChangeHandler,
    OrchestrationPlanFormModel,
    OrchestrationRunButtonDisplay,
    OrchestrationVisualEditorDisplay,
  } from "$domains/orchestration/index.js";

  interface Props {
    active?: boolean;
    model: OrchestrationPlanFormModel;
    onChange?: OrchestrationPlanChangeHandler | null;
    onErrorChange?: OrchestrationErrorChangeHandler | null;
    onExecute?: () => Promise<void> | void;
    onOpenView?: (view: OrchestrationEditorView) => void;
    runButtonDisplay?: OrchestrationRunButtonDisplay;
    visualDisplay: OrchestrationVisualEditorDisplay;
  }

  let {
    active = false,
    model,
    visualDisplay,
    onChange = null,
    onErrorChange = null,
    onOpenView,
    onExecute,
    runButtonDisplay = {},
  }: Props = $props();
</script>

<OrchestrationFlowCanvas
  {active}
  {model}
  {visualDisplay}
  {onChange}
  {onErrorChange}
  {onOpenView}
  {onExecute}
  {runButtonDisplay}
/>

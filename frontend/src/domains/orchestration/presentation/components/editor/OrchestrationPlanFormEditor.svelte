<script lang="ts">
  import OrchestrationFlowCanvas from "$domains/orchestration/presentation/components/canvas/OrchestrationFlowCanvas.svelte";
  import type {
    OrchestrationEditorView,
    OrchestrationErrorChangeHandler,
    OrchestrationPlanChangeHandler,
    OrchestrationPlanFormModel,
    OrchestrationVisualEditorDisplay,
  } from "$domains/orchestration/index.js";

  interface Props {
    readonly?: boolean;
    active?: boolean;
    model: OrchestrationPlanFormModel;
    onChange?: OrchestrationPlanChangeHandler | null;
    onErrorChange?: OrchestrationErrorChangeHandler | null;
    onOpenView?: (view: OrchestrationEditorView) => void;
    visualDisplay: OrchestrationVisualEditorDisplay;
  }

  let {
    readonly = false,
    active = false,
    model,
    visualDisplay,
    onChange = null,
    onErrorChange = null,
    onOpenView,
  }: Props = $props();
</script>

<OrchestrationFlowCanvas
  {readonly}
  {active}
  {model}
  {visualDisplay}
  {onChange}
  {onErrorChange}
  {onOpenView}
/>

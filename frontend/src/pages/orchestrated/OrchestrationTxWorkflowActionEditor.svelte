<script lang="ts">
  import { onMount } from "svelte";
  import { createOrchestrationTxWorkflowActionEditorWorkspace } from "$domains/orchestration/index.js";
  import OrchestrationTxWorkflowActionSettingsEditor from "./OrchestrationTxWorkflowActionSettingsEditor.svelte";
  import OrchestrationTxWorkflowSourceEditor from "./OrchestrationTxWorkflowSourceEditor.svelte";
  import { orchestrationCreateTxWorkflowActionModel } from "$domains/orchestration/index.js";
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
    settingsOnly?: boolean;
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
    settingsOnly = false,
  }: Props = $props();

  const workspace = createOrchestrationTxWorkflowActionEditorWorkspace();
  const {
    actionCallbacksStateStore,
    setTxWorkflowActionContext,
    templateErrorStateStore,
    templateOptionsStateStore,
  } = workspace;
  let actionEditorCallbacks = $derived($actionCallbacksStateStore);
  let templateOptions = $derived($templateOptionsStateStore);
  let templateError = $derived($templateErrorStateStore);
  let txWorkflow = $derived(
    jobRow?.job?.action?.txWorkflow ??
      orchestrationCreateTxWorkflowActionModel(),
  );
  let txWorkflowRows = $derived(jobRow.txWorkflowRows);

  onMount(() => {
    workspace.refreshTemplateOptions();
  });

  $effect(() => {
    setTxWorkflowActionContext({
      jobIndex,
      model,
      onChange,
      onErrorChange,
      stageIndex,
    });
  });
</script>

<div class="grid gap-3 md:grid-cols-2">
  <OrchestrationTxWorkflowActionSettingsEditor
    {txWorkflow}
    {visualDisplay}
    onSourceChange={actionEditorCallbacks.sourceChange}
  />
  <OrchestrationTxWorkflowSourceEditor
    sourceValue={txWorkflowRows.sourceValue}
    {txWorkflow}
    {visualDisplay}
    sourceBindings={actionEditorCallbacks.sourceBindings}
    {templateOptions}
    {templateError}
    {settingsOnly}
  />
</div>

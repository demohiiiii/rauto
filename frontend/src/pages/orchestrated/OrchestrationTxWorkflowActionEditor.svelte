<script>
  import { onMount } from "svelte";
  import { createOrchestrationTxWorkflowActionEditorWorkspace } from "../../modules/orchestration/orchestrationTxWorkflowActions.js";
  import OrchestrationTxWorkflowActionSettingsEditor from "./OrchestrationTxWorkflowActionSettingsEditor.svelte";
  import OrchestrationTxWorkflowSourceEditor from "./OrchestrationTxWorkflowSourceEditor.svelte";

  let {
    model,
    stageIndex,
    jobIndex,
    jobRow,
    visualDisplay,
    onChange,
    onErrorChange,
    settingsOnly = false,
  } = $props();

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
  let txWorkflow = $derived(jobRow?.job?.action?.txWorkflow || {});
  let txWorkflowRows = $derived(jobRow?.txWorkflowRows || {});

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
    {txWorkflowRows}
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

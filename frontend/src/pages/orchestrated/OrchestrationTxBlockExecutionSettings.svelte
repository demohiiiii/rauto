<script>
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import { createOrchestrationTxBlockExecutionSettingsWorkspace } from "../../modules/orchestrationEditorState.js";

  let {
    txBlock,
    showMode = true,
    columnSpanClass = "",
    onModeInput,
    onTimeoutInput,
    onResourceRollbackInput,
    onRollbackOnFailureChange,
    onRollbackTriggerInput,
    onSetFieldPresence,
  } = $props();
  const orchestrationTxBlockExecutionSettingsWorkspace =
    createOrchestrationTxBlockExecutionSettingsWorkspace();
  const {
    executionCallbacksStateStore,
    executionFieldRowsStateStore,
    setExecutionSettingsContext,
  } = orchestrationTxBlockExecutionSettingsWorkspace;
  let executionCallbacks = $derived($executionCallbacksStateStore);
  let executionFieldRows = $derived($executionFieldRowsStateStore);

  $effect(() => {
    setExecutionSettingsContext({
      onModeInput,
      onResourceRollbackInput,
      onRollbackOnFailureChange,
      onRollbackTriggerInput,
      onSetFieldPresence,
      onTimeoutInput,
      showMode,
      txBlock,
    });
  });
</script>

<PresenceFieldGrid
  fieldRows={executionFieldRows}
  hostClass="contents"
  itemClass={columnSpanClass}
  itemClassByFieldKey={{ rollbackOnFailure: "self-end" }}
  onValueChangeForKey={executionCallbacks.valueHandler}
  onPresenceChangeForKey={executionCallbacks.presenceHandler}
/>

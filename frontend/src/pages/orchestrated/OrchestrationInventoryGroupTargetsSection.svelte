<script>
  import { createOrchestrationInventoryGroupTargetsSectionWorkspace } from "../../modules/orchestrationInventoryTargets.js";
  import OrchestrationInventoryGroupTargetsEditor from "./OrchestrationInventoryGroupTargetsEditor.svelte";

  let { model, groupRow, inventoryDisplay, onChange } = $props();

  const inventoryGroupTargetsSectionWorkspace =
    createOrchestrationInventoryGroupTargetsSectionWorkspace();
  const { sectionCallbacksStateStore, setInventoryGroupTargetsSectionContext } =
    inventoryGroupTargetsSectionWorkspace;
  let sectionCallbacks = $derived($sectionCallbacksStateStore);

  $effect(() => {
    setInventoryGroupTargetsSectionContext({
      groupIndex: groupRow.groupIndex,
      model,
      onChange,
    });
  });
</script>

<OrchestrationInventoryGroupTargetsEditor
  group={groupRow.group}
  {groupRow}
  {inventoryDisplay}
  onSetTargetsPresence={sectionCallbacks.setTargetsPresence}
  onAddSimpleTarget={sectionCallbacks.addSimpleTarget}
  onUpdateSimpleTarget={sectionCallbacks.updateSimpleTarget}
  onRemoveSimpleTarget={sectionCallbacks.removeSimpleTarget}
  onAddTarget={sectionCallbacks.addTarget}
  onRemoveTarget={sectionCallbacks.removeTarget}
  onTargetKindChange={sectionCallbacks.changeTargetKind}
  onTargetConnectionChange={sectionCallbacks.changeTargetConnection}
  onTargetFieldChange={sectionCallbacks.changeTargetField}
  onTargetFieldNullableModeChange={sectionCallbacks.changeTargetFieldMode}
  onTargetVarsChange={sectionCallbacks.changeTargetVars}
  onTargetFieldPresenceChange={sectionCallbacks.setTargetFieldPresence}
  onTargetVarsPresenceChange={sectionCallbacks.setTargetVarsPresence}
  onTargetExtraChange={sectionCallbacks.changeTargetExtra}
/>

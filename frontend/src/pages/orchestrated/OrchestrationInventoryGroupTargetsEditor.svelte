<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import PresenceToggle from "../../components/fragments/PresenceToggle.svelte";
  import StringListEditor from "../../components/fragments/StringListEditor.svelte";
  import { createOrchestrationInventoryGroupTargetsEditorWorkspace } from "../../modules/orchestrationInventoryTargets.js";
  import OrchestrationTargetInputEditor from "./OrchestrationTargetInputEditor.svelte";

  let {
    groupRow,
    inventoryDisplay,
    onSetTargetsPresence,
    onAddSimpleTarget,
    onUpdateSimpleTarget,
    onRemoveSimpleTarget,
    onAddTarget,
    onRemoveTarget,
    onTargetKindChange,
    onTargetConnectionChange,
    onTargetFieldChange,
    onTargetFieldNullableModeChange,
    onTargetVarsChange,
    onTargetFieldPresenceChange,
    onTargetVarsPresenceChange,
    onTargetExtraChange,
  } = $props();
  const groupTargetsWorkspace =
    createOrchestrationInventoryGroupTargetsEditorWorkspace();
  const {
    setInventoryGroupTargetsContext,
    targetActionHandlersStateStore: targetActionHandlersStore,
    targetsDisplayStateStore: targetsDisplayStore,
  } = groupTargetsWorkspace;
  let targetsDisplayStateStore = $derived(targetsDisplayStore);
  let targetActionHandlersStateStore = $derived(targetActionHandlersStore);
  let targetsDisplay = $derived($targetsDisplayStateStore);
  let targetActionHandlers = $derived($targetActionHandlersStateStore);

  $effect(() => {
    setInventoryGroupTargetsContext({
      groupRow,
      onSetTargetsPresence,
      onAddSimpleTarget,
      onUpdateSimpleTarget,
      onRemoveSimpleTarget,
      onAddTarget,
      onRemoveTarget,
      onTargetKindChange,
      onTargetConnectionChange,
      onTargetFieldChange,
      onTargetFieldNullableModeChange,
      onTargetVarsChange,
      onTargetFieldPresenceChange,
      onTargetVarsPresenceChange,
      onTargetExtraChange,
    });
  });
</script>

<div class="grid gap-2">
  <div class="mb-2 flex items-center justify-between gap-3">
    <span class="text-sm font-medium text-foreground">
      {targetsDisplay.targetLabelText}
    </span>
    <PresenceToggle
      checked={targetsDisplay.targetsEnabled}
      onChange={targetActionHandlers.setTargetsPresenceHandler()}
    />
  </div>
  {#if targetsDisplay.targetsEnabled}
    {#if targetsDisplay.showDetailedTargets}
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>{targetsDisplay.targetLabelText}</span>
        <Button
          size="sm"
          type="button"
          onclick={targetActionHandlers.addTargetHandler}
        >
          {targetsDisplay.addButtonLabelText}
        </Button>
      </div>
      {#each groupRow.targetRows as targetRow (targetRow.targetIndex)}
        <OrchestrationTargetInputEditor
          titleText={`${targetsDisplay.targetLabelText} ${targetRow.targetIndex + 1}`}
          target={targetRow.target}
          connectionOptionRows={targetRow.targetConnectionOptionRows}
          targetDetail={targetRow.targetDetail}
          targetFieldRows={targetRow.targetFieldRows}
          varsText={targetRow.varsText}
          targetInputKindRows={inventoryDisplay.targetInputKindRows}
          jsonValueTypeRows={inventoryDisplay.jsonValueTypeRows}
          onKindChange={targetActionHandlers.targetKindHandler(
            targetRow.targetIndex,
          )}
          onConnectionChange={targetActionHandlers.targetConnectionHandler(
            targetRow.targetIndex,
          )}
          onFieldChange={targetActionHandlers.targetFieldHandler(
            targetRow.targetIndex,
          )}
          onFieldNullableModeChange={targetActionHandlers.targetFieldNullableModeHandler(
            targetRow.targetIndex,
          )}
          onVarsChange={targetActionHandlers.targetVarsHandler(
            targetRow.targetIndex,
          )}
          onFieldPresenceChange={targetActionHandlers.targetFieldPresenceHandler(
            targetRow.targetIndex,
          )}
          onVarsPresenceChange={targetActionHandlers.targetVarsPresenceHandler(
            targetRow.targetIndex,
          )}
          onExtraChange={targetActionHandlers.targetExtraHandler(
            targetRow.targetIndex,
          )}
          onRemove={targetActionHandlers.removeTargetHandler(
            targetRow.targetIndex,
          )}
        />
      {/each}
    {:else}
      <StringListEditor
        labelText={targetsDisplay.targetLabelText}
        itemRows={targetsDisplay.simpleTargetRows}
        addButtonLabel={targetsDisplay.addButtonLabelText}
        removeButtonLabel={targetsDisplay.removeButtonLabelText}
        placeholderText={targetsDisplay.placeholderText}
        onAdd={targetActionHandlers.addSimpleTargetHandler}
        onValueChange={targetActionHandlers.simpleTargetValueHandler}
        onRemove={targetActionHandlers.removeSimpleTargetHandler}
      />
    {/if}
  {/if}
</div>

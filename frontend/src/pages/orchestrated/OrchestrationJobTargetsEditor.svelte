<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import PresenceToggle from "../../components/fragments/PresenceToggle.svelte";
  import StringListEditor from "../../components/fragments/StringListEditor.svelte";
  import { createOrchestrationJobTargetsEditorWorkspace } from "../../modules/orchestrationStageTargetsState.js";
  import OrchestrationTargetInputEditor from "./OrchestrationTargetInputEditor.svelte";

  let {
    jobRow,
    visualDisplay,
    onAddStringListItem,
    onAddTarget,
    onRemoveStringListItem,
    onRemoveTarget,
    onSetListPresence,
    onTargetConnectionChange,
    onTargetExtraChange,
    onTargetFieldChange,
    onTargetFieldNullableModeChange,
    onTargetFieldPresenceChange,
    onTargetKindChange,
    onTargetVarsChange,
    onTargetVarsPresenceChange,
    onUpdateStringListItem,
  } = $props();
  const jobTargetsWorkspace = createOrchestrationJobTargetsEditorWorkspace();
  let jobTargetsDisplayStateStore = $derived(
    jobTargetsWorkspace.jobTargetsDisplayStateStore,
  );
  let targetActionHandlersStateStore = $derived(
    jobTargetsWorkspace.targetActionHandlersStateStore,
  );
  const { setJobTargetsContext } = jobTargetsWorkspace;
  let jobTargetsDisplay = $derived($jobTargetsDisplayStateStore);
  let targetActionHandlers = $derived($targetActionHandlersStateStore);

  $effect(() => {
    setJobTargetsContext({
      jobRow,
      onAddStringListItem,
      onAddTarget,
      onRemoveStringListItem,
      onRemoveTarget,
      onSetListPresence,
      onTargetConnectionChange,
      onTargetExtraChange,
      onTargetFieldChange,
      onTargetFieldNullableModeChange,
      onTargetFieldPresenceChange,
      onTargetKindChange,
      onTargetVarsChange,
      onTargetVarsPresenceChange,
      onUpdateStringListItem,
    });
  });
</script>

<div class="grid gap-3 md:grid-cols-2">
  <div>
    <div class="mb-2 flex items-center justify-between gap-3">
      <span class="text-sm font-medium text-foreground"
        >{jobTargetsDisplay.targetGroupsField.labelText}</span
      >
      <PresenceToggle
        checked={jobTargetsDisplay.targetGroupsField.enabled}
        onCheckedChange={targetActionHandlers.listPresenceHandler(
          "targetGroups",
        )}
      />
    </div>
    {#if jobTargetsDisplay.targetGroupsField.enabled}
      <StringListEditor
        labelText={jobTargetsDisplay.targetGroupsField.labelText}
        itemRows={jobTargetsDisplay.targetGroupsField.itemRows}
        addButtonLabel={jobTargetsDisplay.targetGroupsField.addButtonLabelText}
        removeButtonLabel={jobTargetsDisplay.targetGroupsField
          .removeButtonLabelText}
        placeholderText={jobTargetsDisplay.targetGroupsField.placeholderText}
        onAdd={targetActionHandlers.addStringListItemHandler("targetGroups")}
        onValueChange={targetActionHandlers.updateStringListItemHandler(
          "targetGroups",
        )}
        onRemove={targetActionHandlers.removeStringListItemHandler(
          "targetGroups",
        )}
      />
    {/if}
  </div>

  <div>
    <div class="mb-2 flex items-center justify-between gap-3">
      <span class="text-sm font-medium text-foreground"
        >{jobTargetsDisplay.targetTagsField.labelText}</span
      >
      <PresenceToggle
        checked={jobTargetsDisplay.targetTagsField.enabled}
        onCheckedChange={targetActionHandlers.listPresenceHandler("targetTags")}
      />
    </div>
    {#if jobTargetsDisplay.targetTagsField.enabled}
      <StringListEditor
        labelText={jobTargetsDisplay.targetTagsField.labelText}
        itemRows={jobTargetsDisplay.targetTagsField.itemRows}
        addButtonLabel={jobTargetsDisplay.targetTagsField.addButtonLabelText}
        removeButtonLabel={jobTargetsDisplay.targetTagsField
          .removeButtonLabelText}
        placeholderText={jobTargetsDisplay.targetTagsField.placeholderText}
        onAdd={targetActionHandlers.addStringListItemHandler("targetTags")}
        onValueChange={targetActionHandlers.updateStringListItemHandler(
          "targetTags",
        )}
        onRemove={targetActionHandlers.removeStringListItemHandler(
          "targetTags",
        )}
      />
    {/if}
  </div>
</div>

<div class="grid gap-2">
  <div class="mb-2 flex items-center justify-between gap-3">
    <span class="text-sm font-medium text-foreground">
      {jobTargetsDisplay.targetsField.labelText}
    </span>
    <PresenceToggle
      checked={jobTargetsDisplay.targetsField.enabled}
      onCheckedChange={targetActionHandlers.listPresenceHandler("targets")}
    />
  </div>
  {#if jobTargetsDisplay.targetsField.enabled}
    <div class="flex flex-wrap items-center justify-between gap-3">
      <span>{jobTargetsDisplay.targetsField.labelText}</span>
      <Button
        size="sm"
        type="button"
        onclick={targetActionHandlers.addTargetHandler}
      >
        {jobTargetsDisplay.targetsField.addButtonLabelText}
      </Button>
    </div>
    {#each jobTargetsDisplay.targetsField.targetRows as targetRow (targetRow.targetIndex)}
      <OrchestrationTargetInputEditor
        titleText={jobTargetsDisplay.targetsField.targetTitleText(
          targetRow.targetIndex,
        )}
        target={targetRow.target}
        connectionOptionRows={targetRow.targetConnectionOptionRows}
        targetDetail={targetRow.targetDetail}
        targetFieldRows={targetRow.targetFieldRows}
        varsText={targetRow.varsText}
        targetInputKindRows={visualDisplay.targetInputKindRows}
        jsonValueTypeRows={visualDisplay.jsonValueTypeRows}
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
        onFieldPresenceChange={targetActionHandlers.targetFieldPresenceHandler(
          targetRow.targetIndex,
        )}
        onVarsChange={targetActionHandlers.targetVarsHandler(
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
  {/if}
</div>

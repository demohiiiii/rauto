<script>
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import PresenceToggle from "../../components/fragments/PresenceToggle.svelte";
  import StringListEditor from "../../components/fragments/StringListEditor.svelte";
  import { t } from "../../lib/i18n.js";
  import { createOrchestrationTxBlockDirectSourceWorkspace } from "../../modules/orchestrationEditorState.js";
  import OrchestrationTxBlockExecutionSettings from "./OrchestrationTxBlockExecutionSettings.svelte";

  let { txBlock, txBlockRows, visualDisplay, sourceBindings } = $props();
  const orchestrationTxBlockDirectSourceWorkspace =
    createOrchestrationTxBlockDirectSourceWorkspace();
  const {
    setSourceContext,
    sourceActionHandlersStateStore,
    sourceDisplayStateStore,
  } = orchestrationTxBlockDirectSourceWorkspace;
  let sourceActionHandlers = $derived($sourceActionHandlersStateStore);
  let sourceDisplay = $derived($sourceDisplayStateStore);

  $effect(() => {
    setSourceContext({ sourceBindings, txBlock, txBlockRows });
  });
</script>

<PresenceFieldGrid
  fieldRows={[sourceDisplay.templateField]}
  hostClass="contents"
  onValueChange={sourceActionHandlers.templateChangeHandler()}
  onPresenceChange={sourceActionHandlers.fieldToggleHandler(
    sourceDisplay.templateField.fieldKey,
  )}
/>

<OrchestrationTxBlockExecutionSettings
  {txBlock}
  on-mode-input={sourceBindings.setMode}
  on-timeout-input={sourceBindings.setTimeoutSecs}
  on-resource-rollback-input={sourceBindings.setResourceRollbackCommand}
  on-rollback-on-failure-change={sourceBindings.setRollbackOnFailure}
  on-rollback-trigger-input={sourceBindings.setRollbackTriggerStepIndex}
  on-set-field-presence={sourceBindings.fieldPresenceChange}
/>

<div class="flex flex-col gap-2">
  <div class="mb-1 flex items-center justify-between gap-3">
    <span class="text-sm font-medium text-foreground">
      {sourceDisplay.varsField.labelText}
    </span>
    <PresenceToggle
      checked={sourceDisplay.varsField.present}
      onCheckedChange={sourceActionHandlers.objectToggleHandler(
        sourceDisplay.varsField.fieldKey,
      )}
    />
  </div>
  {#if sourceDisplay.varsField.present}
    <JsonObjectFieldsEditor
      title={sourceDisplay.varsField.labelText}
      source={sourceDisplay.varsField.source}
      typeRows={visualDisplay.jsonValueTypeRows}
      onChange={sourceActionHandlers.varsChangeHandler()}
    />
  {/if}
</div>

<div class="md:col-span-2">
  <div class="mb-2 flex items-center justify-between gap-3">
    <span class="text-sm font-medium text-foreground">
      {sourceDisplay.commandsField.labelText}
    </span>
    <PresenceToggle
      checked={sourceDisplay.commandsField.present}
      onCheckedChange={sourceActionHandlers.listToggleHandler(
        sourceDisplay.commandsField.fieldKey,
      )}
    />
  </div>
  {#if sourceDisplay.commandsField.present}
    <StringListEditor
      labelText={sourceDisplay.commandsField.labelText}
      itemRows={sourceDisplay.commandsField.itemRows}
      addButtonLabel={t("txBlockFormAddStep")}
      removeButtonLabel={t("deleteBtn")}
      placeholderText={sourceDisplay.commandsField.labelText}
      onAdd={sourceActionHandlers.appendListItem(
        sourceDisplay.commandsFieldHandlerKey,
      )}
      onValueChange={sourceActionHandlers.changeListItem(
        sourceDisplay.commandsFieldHandlerKey,
      )}
      onRemove={sourceActionHandlers.deleteListItem(
        sourceDisplay.commandsFieldHandlerKey,
      )}
    />
  {/if}
</div>

<div class="md:col-span-2">
  <div class="mb-2 flex items-center justify-between gap-3">
    <span class="text-sm font-medium text-foreground"
      >{sourceDisplay.rollbackCommandsField.labelText}</span
    >
    <PresenceToggle
      checked={sourceDisplay.rollbackCommandsField.present}
      onCheckedChange={sourceActionHandlers.listToggleHandler(
        sourceDisplay.rollbackCommandsField.fieldKey,
      )}
    />
  </div>
  {#if sourceDisplay.rollbackCommandsField.present}
    <StringListEditor
      labelText={sourceDisplay.rollbackCommandsField.labelText}
      itemRows={sourceDisplay.rollbackCommandsField.itemRows}
      addButtonLabel={t("txBlockFormAddStep")}
      removeButtonLabel={t("deleteBtn")}
      placeholderText={sourceDisplay.rollbackCommandsField.labelText}
      onAdd={sourceActionHandlers.appendListItem(
        sourceDisplay.rollbackCommandsFieldHandlerKey,
      )}
      onValueChange={sourceActionHandlers.changeListItem(
        sourceDisplay.rollbackCommandsFieldHandlerKey,
      )}
      onRemove={sourceActionHandlers.deleteListItem(
        sourceDisplay.rollbackCommandsFieldHandlerKey,
      )}
    />
  {/if}
</div>

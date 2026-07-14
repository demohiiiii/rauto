<script>
  import {
    CommandFlowRuntimeFields,
    CommandFlowTemplateSource,
  } from "../../components/command-flow/index.js";
  import PlainTextAreaField from "../../components/fragments/PlainTextAreaField.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import PresenceToggle from "../../components/fragments/PresenceToggle.svelte";
  import StringListEditor from "../../components/fragments/StringListEditor.svelte";
  import { t } from "../../lib/i18n.js";
  import { createOrchestrationTxBlockFlowSourceWorkspace } from "../../modules/orchestrationEditorState.js";
  import OrchestrationTxBlockExecutionSettings from "./OrchestrationTxBlockExecutionSettings.svelte";

  let {
    sourceValue = "",
    txBlock,
    txBlockRows,
    visualDisplay,
    sourceBindings,
  } = $props();
  const orchestrationTxBlockFlowSourceWorkspace =
    createOrchestrationTxBlockFlowSourceWorkspace();
  const {
    setSourceContext,
    sourceActionHandlersStateStore,
    sourceDisplayStateStore,
  } = orchestrationTxBlockFlowSourceWorkspace;
  let sourceActionHandlers = $derived($sourceActionHandlersStateStore);
  let sourceDisplay = $derived($sourceDisplayStateStore);

  $effect(() => {
    setSourceContext({ sourceBindings, txBlock, txBlockRows });
  });
</script>

<div class="grid gap-5 md:col-span-2">
  <CommandFlowTemplateSource
    title={t("flowTemplateSourceTitle")}
    description={t("flowTemplateSourceHint")}
  >
    {#if sourceDisplay.showInputField}
      <PresenceFieldGrid
        fieldRows={[sourceDisplay.primaryField]}
        hostClass="contents"
        onValueChange={sourceActionHandlers.sourceInputHandler(
          sourceDisplay.primaryFieldHandlerKey,
        )}
        onNullableModeChange={sourceActionHandlers.nullableModeHandler(
          sourceDisplay.primaryField.fieldKey,
        )}
        onPresenceChange={sourceActionHandlers.fieldToggleHandler(
          sourceDisplay.primaryField.fieldKey,
        )}
      />
    {:else if sourceDisplay.showTextAreaField}
      <label class="flex flex-col gap-2">
        <div class="flex items-center justify-between gap-3">
          <span class="text-sm font-medium text-foreground">
            {sourceDisplay.primaryField.labelText}
          </span>
          <PresenceToggle
            checked={sourceDisplay.primaryField.enabled}
            onCheckedChange={sourceActionHandlers.fieldToggleHandler(
              sourceDisplay.primaryField.fieldKey,
            )}
          />
        </div>
        <PlainTextAreaField
          class="min-h-36 font-mono text-sm"
          value={sourceDisplay.primaryField.valueText}
          onValueInput={sourceActionHandlers.sourceInputHandler(
            sourceDisplay.primaryFieldHandlerKey,
          )}
          disabled={!sourceDisplay.primaryField.enabled}
        />
      </label>
    {/if}
  </CommandFlowTemplateSource>

  <CommandFlowRuntimeFields
    display={sourceDisplay.flowVarsField.runtimeDisplay}
    onFieldValueChange={sourceActionHandlers.flowVarValueHandler}
    onJsonOverridesChange={sourceActionHandlers.flowVarsJsonHandler}
    showJsonOverrides={true}
  >
    {#snippet actions()}
      <PresenceToggle
        checked={sourceDisplay.flowVarsField.present}
        onCheckedChange={sourceActionHandlers.objectToggleHandler(
          sourceDisplay.flowVarsField.fieldKey,
        )}
      />
    {/snippet}
  </CommandFlowRuntimeFields>

  <OrchestrationTxBlockExecutionSettings
    {txBlock}
    on-mode-input={sourceBindings.setMode}
    on-timeout-input={sourceBindings.setTimeoutSecs}
    on-resource-rollback-input={sourceBindings.setResourceRollbackCommand}
    on-rollback-on-failure-change={sourceBindings.setRollbackOnFailure}
    on-rollback-trigger-input={sourceBindings.setRollbackTriggerStepIndex}
    on-set-field-presence={sourceBindings.fieldPresenceChange}
  />
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

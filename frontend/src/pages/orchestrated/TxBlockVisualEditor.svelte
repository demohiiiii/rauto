<script>
  import FileCode2Icon from "@lucide/svelte/icons/file-code-2";
  import ListTreeIcon from "@lucide/svelte/icons/list-tree";
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { t } from "../../lib/i18n.js";
  import TxBlockRollbackPolicyEditor from "./TxBlockRollbackPolicyEditor.svelte";
  import TxBlockRootSettingsEditor from "./TxBlockRootSettingsEditor.svelte";
  import TxBlockStepEditor from "./TxBlockStepEditor.svelte";
  import TxFormSection from "./TxFormSection.svelte";
  import { createTxBlockVisualEditorWorkspace } from "../../modules/transactionBlockDisplays.js";

  import {
    txBlockCommandMetadataFieldDefs,
    txBlockRollbackCommandMetadataFieldDefs,
  } from "../../modules/transactionStructure.js";

  let {
    model,
    onChange,
    stepRunCommandMetadataFieldDefs = null,
    stepRollbackCommandMetadataFieldDefs = null,
  } = $props();

  const txBlockVisualEditorWorkspace = createTxBlockVisualEditorWorkspace();
  const {
    editorActionHandlersStateStore,
    editorDisplayStateStore,
    rollbackPanelStateStore,
    rootPanelStateStore,
    setVisualEditorContext,
    stepsPanelStateStore,
  } = txBlockVisualEditorWorkspace;

  let editorDisplay = $derived($editorDisplayStateStore);
  let editorActionHandlers = $derived($editorActionHandlersStateStore);
  let rootPanel = $derived($rootPanelStateStore);
  let rollbackPanel = $derived($rollbackPanelStateStore);
  let stepsPanel = $derived($stepsPanelStateStore);

  $effect(() => {
    setVisualEditorContext({ model, onChange });
  });
</script>

<div class="grid gap-4">
  <TxBlockRootSettingsEditor
    fieldRows={rootPanel.fieldRows}
    metadataFieldRows={rootPanel.metadataFieldRows}
    onValueChange={editorActionHandlers.rootValueHandler}
    onPresenceChange={editorActionHandlers.rootPresenceHandler}
    onMetadataValueChange={editorActionHandlers.rootExtraValueHandler}
    onMetadataPresenceChange={editorActionHandlers.rootExtraPresenceHandler}
  />

  <TxBlockRollbackPolicyEditor
    {editorDisplay}
    jsonValueTypeRows={editorDisplay.jsonValueTypeRows}
    rollbackKindRows={editorDisplay.rollbackKindRows}
    rollbackKindValue={rollbackPanel.rollbackKindValue}
    showWholeResource={rollbackPanel.showWholeResource}
    wholeResourceFieldRows={rollbackPanel.wholeResourceFieldRows}
    metadataFieldRows={rollbackPanel.metadataFieldRows}
    wholeResourceExtra={rollbackPanel.wholeResourceExtra}
    wholeResourceRollback={rollbackPanel.wholeResourceRollback}
    onRollbackKindChange={editorActionHandlers.rollbackKindValueHandler()}
    onWholeResourceFieldInput={editorActionHandlers.wholeFieldValueHandler}
    onWholeResourceFieldPresenceChange={editorActionHandlers.wholeFieldPresenceHandler}
    onWholeResourceMetadataInput={editorActionHandlers.wholeResourceExtraValueHandler}
    onWholeResourceMetadataPresenceChange={editorActionHandlers.wholeResourceExtraPresenceHandler}
    onWholeResourceExtraChange={editorActionHandlers.setWholeResourceExtra}
    onWholeResourceRollbackChange={editorActionHandlers.setWholeResourceRollback}
  />

  <TxFormSection
    icon={FileCode2Icon}
    title={t("txBlockFormRootExtra")}
    description={t("txBlockFormJsonExtraHint")}
  >
    <JsonObjectFieldsEditor
      title={t("txBlockFormRootExtra")}
      source={rootPanel.extraSource}
      typeRows={editorDisplay.jsonValueTypeRows}
      onChange={editorActionHandlers.setRootExtra}
    />
  </TxFormSection>

  <TxFormSection
    icon={ListTreeIcon}
    title={t("txBlockFormSteps")}
    description={t("txBlockFormStepsHint")}
  >
    {#snippet actions()}
      <Button size="sm" type="button" onclick={editorActionHandlers.appendStep}>
        {t("txBlockFormAddStep")}
      </Button>
    {/snippet}
    {#each stepsPanel.stepRows as stepRow (stepRow.stepIndex)}
      <TxBlockStepEditor
        step={stepRow.step}
        titleText={stepRow.titleText}
        {editorDisplay}
        runCommandMetadataFieldDefs={stepRunCommandMetadataFieldDefs ||
          txBlockCommandMetadataFieldDefs()}
        rollbackCommandMetadataFieldDefs={stepRollbackCommandMetadataFieldDefs ||
          txBlockRollbackCommandMetadataFieldDefs()}
        onRemove={editorActionHandlers.stepRemoveAction(stepRow.stepIndex)}
        onRunChange={editorActionHandlers.stepRunChangeAction(
          stepRow.stepIndex,
        )}
        onRollbackChange={editorActionHandlers.stepRollbackChangeAction(
          stepRow.stepIndex,
        )}
        onRollbackStateChange={editorActionHandlers.stepRollbackStateAction(
          stepRow.stepIndex,
        )}
        onStepChange={editorActionHandlers.stepChangeAction(stepRow.stepIndex)}
      />
    {/each}
  </TxFormSection>
</div>

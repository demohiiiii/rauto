<script>
  import ListChecksIcon from "@lucide/svelte/icons/list-checks";
  import * as Card from "$lib/components/ui/card";
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { t } from "../../lib/i18n.js";
  import TxBlockOperationEditor from "./TxBlockOperationEditor.svelte";
  import TxFormSection from "./TxFormSection.svelte";
  import { createTxBlockStepEditorWorkspace } from "../../modules/transactionBlockDisplays.js";

  import {
    txBlockCommandMetadataFieldDefs,
    txBlockRollbackCommandMetadataFieldDefs,
  } from "../../modules/transactionStructure.js";

  let {
    step,
    titleText,
    editorDisplay,
    runCommandMetadataFieldDefs = txBlockCommandMetadataFieldDefs(),
    rollbackCommandMetadataFieldDefs = txBlockRollbackCommandMetadataFieldDefs(),
    onRemove,
    onRunChange,
    onRollbackChange,
    onRollbackStateChange,
    onStepChange,
  } = $props();

  const txBlockStepEditorWorkspace = createTxBlockStepEditorWorkspace();
  const {
    rollbackStateStore,
    setStepEditorContext,
    stepActionHandlersStateStore,
    stepFieldRowsStateStore,
    stepMetadataFieldRowsStateStore,
  } = txBlockStepEditorWorkspace;
  let rollbackState = $derived($rollbackStateStore);
  let stepFieldRows = $derived($stepFieldRowsStateStore);
  let stepMetadataFieldRows = $derived($stepMetadataFieldRowsStateStore);
  let stepActionHandlers = $derived($stepActionHandlersStateStore);

  $effect(() => {
    setStepEditorContext({
      step,
      onRollbackStateChange,
      onStepChange,
    });
  });
</script>

<Card.Root class="rounded-2xl">
  <Card.Header>
    <Card.Title>{titleText}</Card.Title>
    <Card.Action>
      <Button variant="ghost" size="sm" type="button" onclick={onRemove}>
        {t("deleteBtn")}
      </Button>
    </Card.Action>
  </Card.Header>
  <Card.Content class="grid gap-4">
    <TxBlockOperationEditor
      operation={step.run}
      title={t("txBlockFormRunOperation")}
      {editorDisplay}
      commandMetadataFieldDefs={runCommandMetadataFieldDefs}
      onChange={onRunChange}
    />
    <TxFormSection
      icon={ListChecksIcon}
      title={t("txBlockFormStepOptions")}
      description={t("txBlockFormStepOptionsHint")}
    >
      <PresenceFieldGrid
        fieldRows={stepFieldRows}
        hostClass="grid gap-3 md:grid-cols-2"
        presenceControlsMode="advanced"
        onValueChangeForKey={stepActionHandlers.fieldValueHandler}
        onPresenceChangeForKey={stepActionHandlers.fieldPresenceHandler}
      />
      <PresenceFieldGrid
        fieldRows={stepMetadataFieldRows}
        hostClass="grid gap-3 md:grid-cols-2"
        presenceControlsMode="advanced"
        onValueChangeForKey={stepActionHandlers.metadataValueHandler}
        onPresenceChangeForKey={stepActionHandlers.metadataPresenceHandler}
      />
    </TxFormSection>
    {#if rollbackState === "operation" && step.rollback}
      <TxBlockOperationEditor
        operation={step.rollback}
        title={t("txBlockFormRollbackOperation")}
        {editorDisplay}
        commandMetadataFieldDefs={rollbackCommandMetadataFieldDefs}
        onChange={onRollbackChange}
      />
    {/if}
    <JsonObjectFieldsEditor
      title={t("txBlockFormStepExtra")}
      source={step.extra}
      typeRows={editorDisplay.jsonValueTypeRows}
      onChange={stepActionHandlers.setExtra}
    />
  </Card.Content>
</Card.Root>

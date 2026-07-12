<script>
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import { t } from "../../lib/i18n.js";
  import { txBlockFieldRowsWithValidation } from "../../modules/transactionBlockDisplayState.js";
  import { createTxBlockTemplateDefinitionEditorWorkspace } from "../../modules/transactionBlockTemplateWorkspaces.js";

  let {
    operation,
    onChange,
    jsonValueTypeRows,
    validationErrors = [],
    pathPrefix = "",
  } = $props();
  const txBlockTemplateDefinitionEditorWorkspace =
    createTxBlockTemplateDefinitionEditorWorkspace();
  const {
    setTemplateDefinitionContext,
    templateDefinitionActionHandlersStateStore,
    templateDefinitionFieldRowsStateStore,
    templateDefinitionMetadataFieldRowsStateStore,
    templateExtraSourceStateStore,
    templateOperationMetadataFieldRowsStateStore,
  } = txBlockTemplateDefinitionEditorWorkspace;
  let definitionActionHandlers = $derived(
    $templateDefinitionActionHandlersStateStore,
  );
  let templateDefinitionFieldRows = $derived(
    $templateDefinitionFieldRowsStateStore,
  );
  let templateDefinitionMetadataFieldRows = $derived(
    $templateDefinitionMetadataFieldRowsStateStore,
  );
  let templateOperationMetadataFieldRows = $derived(
    $templateOperationMetadataFieldRowsStateStore,
  );
  let templateExtraSource = $derived($templateExtraSourceStateStore);
  let validatedTemplateDefinitionFieldRows = $derived(
    txBlockFieldRowsWithValidation(
      templateDefinitionFieldRows,
      validationErrors,
      pathPrefix,
    ),
  );

  $effect(() => {
    setTemplateDefinitionContext({ operation, onChange });
  });
</script>

<div class="grid gap-3">
  <div class="grid gap-3 md:grid-cols-3">
    <PresenceFieldGrid
      fieldRows={validatedTemplateDefinitionFieldRows}
      valueHandlerMode="event"
      presenceControlsMode="hidden"
      hostClass="contents"
      onValueChangeForRow={definitionActionHandlers.fieldValueHandler}
      onNullableModeChangeForRow={definitionActionHandlers.fieldNullableModeHandler}
      onPresenceChangeForRow={definitionActionHandlers.fieldPresenceHandler}
    />
    <PresenceFieldGrid
      fieldRows={templateOperationMetadataFieldRows}
      valueHandlerMode="event"
      presenceControlsMode="hidden"
      hostClass="contents"
      onValueChangeForKey={definitionActionHandlers.operationMetadataValueHandler}
      onPresenceChangeForKey={definitionActionHandlers.operationMetadataPresenceHandler}
    />
    <PresenceFieldGrid
      fieldRows={templateDefinitionMetadataFieldRows}
      valueHandlerMode="event"
      presenceControlsMode="hidden"
      hostClass="contents"
      onValueChangeForKey={definitionActionHandlers.templateMetadataValueHandler}
      onPresenceChangeForKey={definitionActionHandlers.templateMetadataPresenceHandler}
    />
  </div>

  <JsonObjectFieldsEditor
    title={t("txBlockFormTemplateDefinitionExtra")}
    source={templateExtraSource}
    typeRows={jsonValueTypeRows}
    onChange={definitionActionHandlers.setTemplateExtra}
  />
</div>

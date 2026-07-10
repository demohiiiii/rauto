<script>
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import { t } from "../../lib/i18n.js";
  import { createTxBlockTemplateDefinitionEditorWorkspace } from "../../modules/transactionBlockTemplateWorkspaces.js";

  let { operation, onChange, jsonValueTypeRows } = $props();
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

  $effect(() => {
    setTemplateDefinitionContext({ operation, onChange });
  });
</script>

<div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
  <div class="mb-3 text-sm font-semibold text-slate-700">
    {t("txBlockFormTemplateDefinition")}
  </div>
  <div class="grid gap-3">
    <div class="grid gap-3 md:grid-cols-3">
      <PresenceFieldGrid
        fieldRows={templateDefinitionFieldRows}
        hostClass="contents"
        onValueChangeForRow={definitionActionHandlers.fieldValueHandler}
        onNullableModeChangeForRow={definitionActionHandlers.fieldNullableModeHandler}
        onPresenceChangeForRow={definitionActionHandlers.fieldPresenceHandler}
      />
      <PresenceFieldGrid
        fieldRows={templateOperationMetadataFieldRows}
        hostClass="contents"
        onValueChangeForKey={definitionActionHandlers.operationMetadataValueHandler}
        onPresenceChangeForKey={definitionActionHandlers.operationMetadataPresenceHandler}
      />
      <PresenceFieldGrid
        fieldRows={templateDefinitionMetadataFieldRows}
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
</div>

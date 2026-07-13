<script>
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import { t } from "../../lib/i18n.js";
  import { txBlockFieldRowsWithValidation } from "../../modules/transactionBlockDisplayState.js";
  import { createTxBlockTemplateRuntimeFieldsEditorWorkspace } from "../../modules/transactionBlockTemplateWorkspaces.js";

  let {
    operation,
    onChange,
    jsonValueTypeRows,
    validationErrors = [],
    pathPrefix = "",
  } = $props();
  const txBlockTemplateRuntimeFieldsEditorWorkspace =
    createTxBlockTemplateRuntimeFieldsEditorWorkspace();
  const {
    destroy,
    runtimeActionHandlersStateStore,
    runtimeExtraSourceStateStore,
    runtimeFieldRowsStateStore,
    runtimeMetadataFieldRowsStateStore,
    setTemplateRuntimeFieldsContext,
  } = txBlockTemplateRuntimeFieldsEditorWorkspace;
  let runtimeActionHandlers = $derived($runtimeActionHandlersStateStore);
  let runtimeExtraSource = $derived($runtimeExtraSourceStateStore);
  let runtimeFieldRows = $derived($runtimeFieldRowsStateStore);
  let runtimeMetadataFieldRows = $derived($runtimeMetadataFieldRowsStateStore);
  let validatedRuntimeFieldRows = $derived(
    txBlockFieldRowsWithValidation(
      runtimeFieldRows,
      validationErrors,
      pathPrefix,
    ),
  );

  $effect(() => {
    setTemplateRuntimeFieldsContext({ operation, onChange });
  });

  $effect(() => destroy);
</script>

<div class="grid gap-4">
  <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
    <PresenceFieldGrid
      fieldRows={validatedRuntimeFieldRows}
      valueHandlerMode="event"
      hostClass="contents"
      presenceControlsMode="hidden"
      onValueChangeForKey={runtimeActionHandlers.fieldValueHandler}
      onNullableModeChangeForKey={runtimeActionHandlers.fieldNullableModeHandler}
      onPresenceChangeForKey={runtimeActionHandlers.fieldPresenceHandler}
    />
    <PresenceFieldGrid
      fieldRows={runtimeMetadataFieldRows}
      valueHandlerMode="event"
      presenceControlsMode="hidden"
      hostClass="contents"
      onValueChangeForKey={runtimeActionHandlers.metadataValueHandler}
      onPresenceChangeForKey={runtimeActionHandlers.metadataPresenceHandler}
    />
  </div>
  <JsonObjectFieldsEditor
    title={t("txBlockFormTemplateRuntimeExtra")}
    source={runtimeExtraSource}
    typeRows={jsonValueTypeRows}
    onChange={runtimeActionHandlers.setRuntimeExtra}
  />
</div>

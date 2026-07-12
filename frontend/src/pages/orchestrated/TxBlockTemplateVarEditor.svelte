<script>
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { t } from "../../lib/i18n.js";
  import { txBlockFieldRowsWithValidation } from "../../modules/transactionBlockDisplayState.js";
  import TxBlockTemplateVarDefaultEditor from "./TxBlockTemplateVarDefaultEditor.svelte";
  import TxBlockTemplateVarOptionsEditor from "./TxBlockTemplateVarOptionsEditor.svelte";
  import { createTxBlockTemplateVarEditorWorkspace } from "../../modules/transactionBlockTemplateWorkspaces.js";

  let {
    operation,
    variableRow,
    onChange,
    jsonValueTypeRows,
    templateVarTypeRows,
    validationErrors = [],
    pathPrefix = "",
  } = $props();

  const txBlockTemplateVarEditorWorkspace =
    createTxBlockTemplateVarEditorWorkspace();
  const {
    setTemplateVarContext,
    variableActionHandlersStateStore,
    variableFieldRowsStateStore,
    variableMetadataFieldRowsStateStore,
    variableRowStateStore,
  } = txBlockTemplateVarEditorWorkspace;
  let variableActionHandlers = $derived($variableActionHandlersStateStore);
  let variableFieldRows = $derived($variableFieldRowsStateStore);
  let variableMetadataFieldRows = $derived(
    $variableMetadataFieldRowsStateStore,
  );
  let syncedVariableRow = $derived($variableRowStateStore);
  let variable = $derived(syncedVariableRow.variable ?? {});
  let validatedVariableFieldRows = $derived(
    txBlockFieldRowsWithValidation(
      variableFieldRows,
      validationErrors,
      pathPrefix,
    ),
  );

  $effect(() => {
    setTemplateVarContext({
      operation,
      onChange,
      templateVarTypeRows,
      variableRow,
    });
  });
</script>

<div
  class="grid gap-3 rounded-lg border border-border bg-muted/20 p-3 md:grid-cols-4"
>
  <PresenceFieldGrid
    fieldRows={validatedVariableFieldRows}
    valueHandlerMode="event"
    presenceControlsMode="hidden"
    hostClass="contents"
    itemClassByFieldKey={{ description: "md:col-span-2" }}
    onValueChangeForKey={variableActionHandlers.fieldValueHandler}
    onNullableModeChangeForKey={variableActionHandlers.fieldNullableModeHandler}
    onPresenceChangeForKey={variableActionHandlers.fieldPresenceHandler}
  />
  <PresenceFieldGrid
    fieldRows={variableMetadataFieldRows}
    valueHandlerMode="event"
    presenceControlsMode="hidden"
    hostClass="contents"
    onValueChangeForKey={variableActionHandlers.metadataValueHandler}
    onPresenceChangeForKey={variableActionHandlers.metadataPresenceHandler}
  />
  <Button
    variant="ghost"
    type="button"
    onclick={variableActionHandlers.removeVar}
  >
    {t("deleteBtn")}
  </Button>
  <TxBlockTemplateVarOptionsEditor
    {operation}
    variableRow={syncedVariableRow}
    {onChange}
  />
  <TxBlockTemplateVarDefaultEditor
    {operation}
    variableRow={syncedVariableRow}
    {onChange}
    {jsonValueTypeRows}
  />
  <div class="md:col-span-4">
    <JsonObjectFieldsEditor
      title={t("txBlockFormTemplateVarExtra")}
      source={variable.extra}
      typeRows={jsonValueTypeRows}
      onChange={variableActionHandlers.setExtra}
    />
  </div>
</div>

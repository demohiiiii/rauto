<script lang="ts">
  import ReadonlyFields from "$components/fragments/ReadonlyFields.svelte";
  import JsonObjectFieldsEditor from "$components/fragments/JsonObjectFieldsEditor.svelte";
  import PresenceFieldGrid from "$components/fragments/PresenceFieldGrid.svelte";
  import { t } from "$lib/i18n.js";
  import type {
    JsonObject,
    txBlockVisualEditorBindings,
    txBlockVisualEditorDisplay,
    txBlockWholeResourceFieldsDisplay,
    TxOperationModel,
    TxValidationError,
  } from "$domains/transactions/index.js";
  import TxBlockOperationEditor from "$domains/transactions/presentation/components/block/TxBlockOperationEditor.svelte";

  type EditorActionHandlers = ReturnType<typeof txBlockVisualEditorBindings>;
  type EditorDisplay = ReturnType<typeof txBlockVisualEditorDisplay>;

  interface Props {
    editorDisplay: EditorDisplay;
    jsonValueTypeRows: EditorDisplay["jsonValueTypeRows"];
    onWholeResourceExtraChange: EditorActionHandlers["setWholeResourceExtra"];
    onWholeResourceFieldInput: EditorActionHandlers["wholeFieldValueHandler"];
    onWholeResourceFieldPresenceChange: EditorActionHandlers["wholeFieldPresenceHandler"];
    onWholeResourceRollbackChange: EditorActionHandlers["setWholeResourceRollback"];
    pathPrefix?: string;
    validationErrors?: readonly TxValidationError[];
    wholeResourceExtra: JsonObject;
    wholeResourceFieldRows?: ReturnType<
      typeof txBlockWholeResourceFieldsDisplay
    >;
    wholeResourceRollback: TxOperationModel;
  }

  let {
    editorDisplay,
    jsonValueTypeRows,
    wholeResourceFieldRows = [],
    wholeResourceExtra,
    wholeResourceRollback,
    onWholeResourceFieldInput,
    onWholeResourceFieldPresenceChange,
    onWholeResourceExtraChange,
    onWholeResourceRollbackChange,
    validationErrors = [],
    pathPrefix = "rollbackPolicy.wholeResource",
  }: Props = $props();
</script>

<section class="grid min-w-0 gap-3 border-t border-border pt-3">
  <ReadonlyFields>
    <PresenceFieldGrid
      fieldRows={wholeResourceFieldRows}
      valueHandlerMode="event"
      presenceControlsMode="hidden"
      onValueChangeForKey={onWholeResourceFieldInput}
      onPresenceChangeForKey={onWholeResourceFieldPresenceChange}
    />
  </ReadonlyFields>

  <TxBlockOperationEditor
    operation={wholeResourceRollback}
    title={t("txBlockFormWholeRollback")}
    {editorDisplay}
    commandMetadataFieldDefs={[]}
    onChange={onWholeResourceRollbackChange}
    {validationErrors}
    pathPrefix={`${pathPrefix}.rollback`}
  />

  <ReadonlyFields>
    <JsonObjectFieldsEditor
      title={t("txBlockFormWholeRollbackExtra")}
      source={wholeResourceExtra}
      typeRows={[...jsonValueTypeRows]}
      onChange={onWholeResourceExtraChange}
    />
  </ReadonlyFields>
</section>

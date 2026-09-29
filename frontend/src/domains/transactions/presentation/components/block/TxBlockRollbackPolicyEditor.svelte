<script lang="ts">
  import ReadonlyFields from "$components/fragments/ReadonlyFields.svelte";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import JsonObjectFieldsEditor from "$components/fragments/JsonObjectFieldsEditor.svelte";
  import PresenceFieldGrid from "$components/fragments/PresenceFieldGrid.svelte";
  import StringSelectField from "$components/fragments/StringSelectField.svelte";
  import { t } from "$lib/i18n.js";
  import type {
    JsonObject,
    txBlockVisualEditorBindings,
    txBlockVisualEditorDisplay,
    txBlockWholeResourceFieldsDisplay,
    TxOperationModel,
    TxValidationError,
  } from "$domains/transactions/index.js";
  import TxFormSection from "$domains/transactions/presentation/components/shared/TxFormSection.svelte";
  import TxBlockOperationEditor from "$domains/transactions/presentation/components/block/TxBlockOperationEditor.svelte";

  type EditorActionHandlers = ReturnType<typeof txBlockVisualEditorBindings>;
  type EditorDisplay = ReturnType<typeof txBlockVisualEditorDisplay>;

  interface Props {
    editorDisplay: EditorDisplay;
    jsonValueTypeRows: EditorDisplay["jsonValueTypeRows"];
    onRollbackKindChange: ReturnType<
      EditorActionHandlers["rollbackKindValueHandler"]
    >;
    onWholeResourceExtraChange: EditorActionHandlers["setWholeResourceExtra"];
    onWholeResourceFieldInput: EditorActionHandlers["wholeFieldValueHandler"];
    onWholeResourceFieldPresenceChange: EditorActionHandlers["wholeFieldPresenceHandler"];
    onWholeResourceRollbackChange: EditorActionHandlers["setWholeResourceRollback"];
    pathPrefix?: string;
    rollbackKindRows: EditorDisplay["rollbackKindRows"];
    rollbackKindValue: string;
    showWholeResource: boolean;
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
    rollbackKindRows,
    rollbackKindValue,
    showWholeResource,
    wholeResourceFieldRows = [],
    wholeResourceExtra,
    wholeResourceRollback,
    onRollbackKindChange,
    onWholeResourceFieldInput,
    onWholeResourceFieldPresenceChange,
    onWholeResourceExtraChange,
    onWholeResourceRollbackChange,
    validationErrors = [],
    pathPrefix = "rollbackPolicy.wholeResource",
  }: Props = $props();
</script>

<section class="grid min-w-0 gap-3">
  <ReadonlyFields>
    <TxFormSection
      icon={RotateCcwIcon}
      title={t("txBlockFormRollbackPolicy")}
      description={t("txBlockFormRollbackPolicyHint")}
    >
      <label class="flex flex-col gap-2">
        <span class="text-sm font-medium text-foreground">
          {t("txBlockFormRollbackPolicy")}
        </span>
        <StringSelectField
          value={rollbackKindValue}
          optionValues={[...rollbackKindRows]}
          onChange={onRollbackKindChange}
        />
      </label>
    </TxFormSection>
  </ReadonlyFields>
  {#if showWholeResource}
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
  {/if}
</section>

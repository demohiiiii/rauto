<script>
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import StringSelectField from "../../components/fragments/StringSelectField.svelte";
  import { t } from "../../lib/i18n.js";
  import TxFormSection from "./TxFormSection.svelte";
  import TxBlockOperationEditor from "./TxBlockOperationEditor.svelte";

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
  } = $props();
</script>

<section class="grid min-w-0 gap-3">
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
        optionValues={rollbackKindRows}
        onChange={onRollbackKindChange}
      />
    </label>
  </TxFormSection>
  {#if showWholeResource}
    <PresenceFieldGrid
      fieldRows={wholeResourceFieldRows}
      valueHandlerMode="event"
      presenceControlsMode="hidden"
      onValueChangeForKey={onWholeResourceFieldInput}
      onPresenceChangeForKey={onWholeResourceFieldPresenceChange}
    />
    <TxBlockOperationEditor
      operation={wholeResourceRollback}
      title={t("txBlockFormWholeRollback")}
      {editorDisplay}
      commandMetadataFieldDefs={[]}
      onChange={onWholeResourceRollbackChange}
      {validationErrors}
      pathPrefix={`${pathPrefix}.rollback`}
    />
    <JsonObjectFieldsEditor
      title={t("txBlockFormWholeRollbackExtra")}
      source={wholeResourceExtra}
      typeRows={jsonValueTypeRows}
      onChange={onWholeResourceExtraChange}
    />
  {/if}
</section>

<script>
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import * as Card from "$lib/components/ui/card";
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
    metadataFieldRows = [],
    wholeResourceExtra,
    wholeResourceRollback,
    onRollbackKindChange,
    onWholeResourceFieldInput,
    onWholeResourceFieldPresenceChange,
    onWholeResourceMetadataInput,
    onWholeResourceMetadataPresenceChange,
    onWholeResourceExtraChange,
    onWholeResourceRollbackChange,
  } = $props();
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>{t("txBlockFormRollbackPolicy")}</Card.Title>
    <Card.Description>{t("txBlockFormRollbackPolicyHint")}</Card.Description>
  </Card.Header>
  <Card.Content class="grid gap-3">
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
        presenceControlsMode="advanced"
        onValueChangeForKey={onWholeResourceFieldInput}
        onPresenceChangeForKey={onWholeResourceFieldPresenceChange}
      />
      <PresenceFieldGrid
        fieldRows={metadataFieldRows}
        presenceControlsMode="advanced"
        onValueChangeForKey={onWholeResourceMetadataInput}
        onPresenceChangeForKey={onWholeResourceMetadataPresenceChange}
      />
      <TxBlockOperationEditor
        operation={wholeResourceRollback}
        title={t("txBlockFormWholeRollback")}
        {editorDisplay}
        commandMetadataFieldDefs={[
          {
            fieldKey: "rollback_label",
            labelKey: "txBlockFormRollbackLabel",
            placeholderKey: "txBlockFormLabelPlaceholder",
          },
        ]}
        onChange={onWholeResourceRollbackChange}
      />
      <JsonObjectFieldsEditor
        title={t("txBlockFormWholeRollbackExtra")}
        source={wholeResourceExtra}
        typeRows={jsonValueTypeRows}
        onChange={onWholeResourceExtraChange}
      />
    {/if}
  </Card.Content>
</Card.Root>

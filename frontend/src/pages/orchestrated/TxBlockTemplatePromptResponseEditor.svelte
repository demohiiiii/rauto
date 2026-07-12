<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PlainCheckboxField from "../../components/fragments/PlainCheckboxField.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import TextAreaField from "../../components/fragments/TextAreaField.svelte";
  import { t } from "../../lib/i18n.js";

  let {
    prompt,
    promptMetadataFieldRows = [],
    jsonValueTypeRows,
    onAppendNewlineChange,
    onDeletePrompt,
    onExtraChange,
    onRecordInputChange,
    onResponseInput,
    onPromptMetadataInput = null,
    onPromptMetadataPresenceChange = null,
  } = $props();
</script>

<div class="grid gap-2 md:grid-cols-2">
  <PresenceFieldGrid
    fieldRows={promptMetadataFieldRows}
    valueHandlerMode="event"
    presenceControlsMode="hidden"
    hostClass="contents"
    onValueChangeForKey={onPromptMetadataInput}
    onPresenceChangeForKey={onPromptMetadataPresenceChange}
  />
  <TextAreaField
    labelText={t("txBlockFormResponsePlaceholder")}
    value={prompt.response}
    onInput={onResponseInput}
    class="font-mono"
    placeholderText={t("txBlockFormResponsePlaceholder")}
  />
  <div class="grid gap-2">
    <PlainCheckboxField
      class="cursor-pointer justify-start gap-2 p-0"
      checked={prompt.appendNewline}
      labelText={t("appendNewlineOption")}
      onChange={onAppendNewlineChange}
    />
    <PlainCheckboxField
      class="cursor-pointer justify-start gap-2 p-0"
      checked={prompt.recordInput}
      labelText={t("fieldRecordInput")}
      onChange={onRecordInputChange}
    />
    <Button
      variant="destructive"
      size="sm"
      type="button"
      onclick={onDeletePrompt}
    >
      {t("deleteBtn")}
    </Button>
  </div>
</div>

<JsonObjectFieldsEditor
  title={t("txBlockFormPromptExtra")}
  source={prompt.extra}
  typeRows={jsonValueTypeRows}
  onChange={onExtraChange}
/>

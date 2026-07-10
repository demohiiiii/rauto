<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PlainCheckboxField from "../../components/fragments/PlainCheckboxField.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import PresenceToggle from "../../components/fragments/PresenceToggle.svelte";
  import TextAreaField from "../../components/fragments/TextAreaField.svelte";
  import { t } from "../../lib/i18n.js";

  let {
    prompt,
    promptMetadataFieldRows = [],
    jsonValueTypeRows,
    onAppendNewlineChange,
    onAppendNewlinePresenceChange,
    onDeletePrompt,
    onExtraChange,
    onRecordInputChange,
    onRecordInputPresenceChange,
    onResponseInput,
    onPromptMetadataInput = null,
    onPromptMetadataPresenceChange = null,
  } = $props();
</script>

<div class="grid gap-2 md:grid-cols-2">
  <PresenceFieldGrid
    fieldRows={promptMetadataFieldRows}
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
    <div class="flex items-center justify-between gap-3">
      <PlainCheckboxField
        class="cursor-pointer justify-start gap-2 p-0"
        checked={prompt.appendNewline}
        disabled={!prompt.hasAppendNewline && !prompt.appendNewline}
        labelText={t("appendNewlineOption")}
        onChange={onAppendNewlineChange}
      />
      <PresenceToggle
        checked={prompt.hasAppendNewline || prompt.appendNewline}
        onChange={onAppendNewlinePresenceChange}
      />
    </div>
    <div class="flex items-center justify-between gap-3">
      <PlainCheckboxField
        class="cursor-pointer justify-start gap-2 p-0"
        checked={prompt.recordInput}
        disabled={!prompt.hasRecordInput && !prompt.recordInput}
        labelText={t("fieldRecordInput")}
        onChange={onRecordInputChange}
      />
      <PresenceToggle
        checked={prompt.hasRecordInput || prompt.recordInput}
        onChange={onRecordInputPresenceChange}
      />
    </div>
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

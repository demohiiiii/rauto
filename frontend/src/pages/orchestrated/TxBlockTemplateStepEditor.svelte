<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import PresenceToggle from "../../components/fragments/PresenceToggle.svelte";
  import { t } from "../../lib/i18n.js";
  import TxBlockTemplatePromptEditor from "./TxBlockTemplatePromptEditor.svelte";
  import { createTxBlockTemplateStepEditorWorkspace } from "../../modules/transactionBlockTemplateWorkspaces.js";

  let { operation, templateStepRow, onChange, jsonValueTypeRows } = $props();
  const txBlockTemplateStepEditorWorkspace =
    createTxBlockTemplateStepEditorWorkspace();
  const {
    setTemplateStepContext,
    stepActionHandlersStateStore,
    templateStepFieldRowsStateStore,
    templateStepMetadataFieldRowsStateStore,
    templateStepRowStateStore,
  } = txBlockTemplateStepEditorWorkspace;
  let stepActionHandlers = $derived($stepActionHandlersStateStore);
  let templateStepFieldRows = $derived($templateStepFieldRowsStateStore);
  let templateStepMetadataFieldRows = $derived(
    $templateStepMetadataFieldRowsStateStore,
  );
  let syncedTemplateStepRow = $derived($templateStepRowStateStore);
  let templateStep = $derived(syncedTemplateStepRow.step);
  let templateStepIndex = $derived(syncedTemplateStepRow.stepIndex);

  $effect(() => {
    setTemplateStepContext({ operation, templateStepRow, onChange });
  });
</script>

<div class="grid gap-3 rounded-lg border border-slate-200 bg-white p-3">
  <div class="flex items-center justify-between">
    <span class="text-xs font-semibold text-slate-500">
      {t("txBlockFormTemplateStep")}
      {templateStepIndex + 1}
    </span>
    <Button
      variant="destructive"
      size="xs"
      type="button"
      onclick={stepActionHandlers.removeStep}
    >
      {t("deleteBtn")}
    </Button>
  </div>
  <div class="grid gap-3 md:grid-cols-3">
    <PresenceFieldGrid
      fieldRows={templateStepFieldRows}
      hostClass="contents"
      itemClassByFieldKey={{ command: "md:col-span-2" }}
      onValueChangeForKey={stepActionHandlers.fieldValueHandler}
      onNullableModeChangeForKey={stepActionHandlers.fieldNullableModeHandler}
      onPresenceChangeForKey={stepActionHandlers.fieldPresenceHandler}
    />
    <PresenceFieldGrid
      fieldRows={templateStepMetadataFieldRows}
      hostClass="contents"
      onValueChangeForKey={stepActionHandlers.metadataValueHandler}
      onPresenceChangeForKey={stepActionHandlers.metadataPresenceHandler}
    />
  </div>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex flex-wrap items-center gap-3">
      <span>{t("txBlockFormPrompts")}</span>
      <PresenceToggle
        checked={syncedTemplateStepRow.promptsPresent}
        onChange={stepActionHandlers.promptsPresenceHandler()}
      />
    </div>
    <Button
      variant="outline"
      size="xs"
      type="button"
      onclick={stepActionHandlers.addPrompt}
    >
      {t("txBlockFormAddPrompt")}
    </Button>
  </div>
  {#if syncedTemplateStepRow.promptsPresent}
    {#each syncedTemplateStepRow.promptRows as promptRow}
      {@const prompt = promptRow.prompt}
      <TxBlockTemplatePromptEditor
        {operation}
        {prompt}
        {promptRow}
        {templateStepIndex}
        {onChange}
        {jsonValueTypeRows}
      />
    {/each}
  {/if}
  <JsonObjectFieldsEditor
    title={t("txBlockFormTemplateStepExtra")}
    source={templateStep.extra}
    typeRows={jsonValueTypeRows}
    onChange={stepActionHandlers.setExtra}
  />
</div>

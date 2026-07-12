<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import { t } from "../../lib/i18n.js";
  import { txBlockFieldRowsWithValidation } from "../../modules/transactionBlockDisplayState.js";
  import TxBlockTemplatePromptEditor from "./TxBlockTemplatePromptEditor.svelte";
  import { createTxBlockTemplateStepEditorWorkspace } from "../../modules/transactionBlockTemplateWorkspaces.js";

  let {
    operation,
    templateStepRow,
    onChange,
    jsonValueTypeRows,
    validationErrors = [],
    pathPrefix = "",
  } = $props();
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
  let templateStep = $derived(syncedTemplateStepRow.step ?? {});
  let templateStepIndex = $derived(syncedTemplateStepRow.stepIndex);
  let validatedTemplateStepFieldRows = $derived(
    txBlockFieldRowsWithValidation(
      templateStepFieldRows,
      validationErrors,
      pathPrefix,
    ),
  );

  $effect(() => {
    setTemplateStepContext({ operation, templateStepRow, onChange });
  });
</script>

<div class="grid gap-3 rounded-lg border border-border bg-muted/20 p-3">
  <div class="flex items-center justify-between">
    <span class="text-xs font-semibold text-muted-foreground">
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
      fieldRows={validatedTemplateStepFieldRows}
      valueHandlerMode="event"
      presenceControlsMode="hidden"
      hostClass="contents"
      itemClassByFieldKey={{ command: "md:col-span-2" }}
      onValueChangeForKey={stepActionHandlers.fieldValueHandler}
      onNullableModeChangeForKey={stepActionHandlers.fieldNullableModeHandler}
      onPresenceChangeForKey={stepActionHandlers.fieldPresenceHandler}
    />
    <PresenceFieldGrid
      fieldRows={templateStepMetadataFieldRows}
      valueHandlerMode="event"
      presenceControlsMode="hidden"
      hostClass="contents"
      onValueChangeForKey={stepActionHandlers.metadataValueHandler}
      onPresenceChangeForKey={stepActionHandlers.metadataPresenceHandler}
    />
  </div>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <span>{t("txBlockFormPrompts")}</span>
    <Button
      variant="outline"
      size="xs"
      type="button"
      onclick={stepActionHandlers.addPrompt}
    >
      {t("txBlockFormAddPrompt")}
    </Button>
  </div>
  {#each syncedTemplateStepRow.promptRows as promptRow}
    {@const prompt = promptRow.prompt}
    <TxBlockTemplatePromptEditor
      {operation}
      {prompt}
      {promptRow}
      {templateStepIndex}
      {onChange}
      {jsonValueTypeRows}
      {validationErrors}
      pathPrefix={`${pathPrefix}.prompts[${promptRow.promptIndex}]`}
    />
  {/each}
  <JsonObjectFieldsEditor
    title={t("txBlockFormTemplateStepExtra")}
    source={templateStep.extra}
    typeRows={jsonValueTypeRows}
    onChange={stepActionHandlers.setExtra}
  />
</div>

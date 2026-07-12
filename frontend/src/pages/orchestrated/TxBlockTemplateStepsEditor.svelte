<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import { t } from "../../lib/i18n.js";
  import { txBlockValidationErrorText } from "../../modules/transactionBlockDisplayState.js";
  import TxBlockTemplateStepEditor from "./TxBlockTemplateStepEditor.svelte";
  import { createTxBlockTemplateStepsEditorWorkspace } from "../../modules/transactionBlockTemplateWorkspaces.js";

  let {
    operation,
    templateDisplay,
    onChange,
    present = true,
    jsonValueTypeRows,
    validationErrors = [],
    pathPrefix = "",
  } = $props();
  const txBlockTemplateStepsEditorWorkspace =
    createTxBlockTemplateStepsEditorWorkspace();
  const {
    setTemplateStepsContext,
    templateDisplayStateStore,
    templateStepActionHandlersStateStore,
  } = txBlockTemplateStepsEditorWorkspace;
  let syncedTemplateDisplay = $derived($templateDisplayStateStore);
  let templateStepActionHandlers = $derived(
    $templateStepActionHandlersStateStore,
  );
  let stepsErrorText = $derived(
    txBlockValidationErrorText(validationErrors, pathPrefix),
  );

  $effect(() => {
    setTemplateStepsContext({ operation, onChange, present });
  });
</script>

<div class="grid gap-4">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <span>{t("txBlockFormTemplateSteps")}</span>
    <Button
      size="sm"
      type="button"
      onclick={templateStepActionHandlers.addStep}
    >
      {t("txBlockFormAddTemplateStep")}
    </Button>
  </div>
  {#if stepsErrorText}
    <p class="text-xs text-destructive" role="alert">{stepsErrorText}</p>
  {/if}
  {#each syncedTemplateDisplay.stepRows as templateStepRow}
    <TxBlockTemplateStepEditor
      {operation}
      {templateStepRow}
      {onChange}
      {jsonValueTypeRows}
      {validationErrors}
      pathPrefix={`${pathPrefix}[${templateStepRow.stepIndex}]`}
    />
  {/each}
</div>

<script>
  import PresenceToggle from "../../components/fragments/PresenceToggle.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { t } from "../../lib/i18n.js";
  import TxBlockTemplateStepEditor from "./TxBlockTemplateStepEditor.svelte";
  import { createTxBlockTemplateStepsEditorWorkspace } from "../../modules/transactionBlockTemplateWorkspaces.js";

  let {
    operation,
    templateDisplay,
    onChange,
    present = true,
    jsonValueTypeRows,
  } = $props();
  const txBlockTemplateStepsEditorWorkspace =
    createTxBlockTemplateStepsEditorWorkspace();
  const {
    presentStateStore,
    setTemplateStepsContext,
    templateDisplayStateStore,
    templateStepActionHandlersStateStore,
  } = txBlockTemplateStepsEditorWorkspace;
  let syncedTemplateDisplay = $derived($templateDisplayStateStore);
  let syncedPresent = $derived($presentStateStore);
  let templateStepActionHandlers = $derived(
    $templateStepActionHandlersStateStore,
  );

  $effect(() => {
    setTemplateStepsContext({ operation, onChange, present });
  });
</script>

<div class="grid gap-4">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex flex-wrap items-center gap-3">
      <span>{t("txBlockFormTemplateSteps")}</span>
      <PresenceToggle
        checked={syncedPresent}
        onChange={templateStepActionHandlers.presenceHandler()}
      />
    </div>
    <Button
      size="sm"
      type="button"
      onclick={templateStepActionHandlers.addStep}
    >
      {t("txBlockFormAddTemplateStep")}
    </Button>
  </div>
  {#if syncedPresent || syncedTemplateDisplay.stepRows.length > 0}
    {#each syncedTemplateDisplay.stepRows as templateStepRow}
      <TxBlockTemplateStepEditor
        {operation}
        {templateStepRow}
        {onChange}
        {jsonValueTypeRows}
      />
    {/each}
  {/if}
</div>

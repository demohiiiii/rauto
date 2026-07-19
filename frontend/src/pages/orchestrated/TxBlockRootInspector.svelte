<script>
  import * as Card from "$lib/components/ui/card";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import { t } from "../../lib/i18n.js";
  import { txBlockValidationErrorText } from "../../modules/transactions/transactionBlockDisplayState.js";
  import TxBlockRollbackPolicyEditor from "./TxBlockRollbackPolicyEditor.svelte";
  import TxBlockRootSettingsEditor from "./TxBlockRootSettingsEditor.svelte";

  let {
    editorDisplay,
    editorActionHandlers,
    rootPanel,
    rollbackPanel,
    validationErrors = [],
    pathPrefix = "",
  } = $props();
  let stepsErrorText = $derived(
    txBlockValidationErrorText(
      validationErrors,
      pathPrefix ? `${pathPrefix}.steps` : "steps",
    ),
  );
</script>

<Card.Content class="min-w-0 px-0">
  <header class="px-4 pb-4 sm:px-6">
    <h2 class="text-base font-semibold text-foreground">
      {t("txBlockInspectorRootTitle")}
    </h2>
    <p class="mt-1 text-xs leading-relaxed text-muted-foreground">
      {t("txBlockInspectorRootHint")}
    </p>
  </header>

  <Separator />

  <div class="grid min-w-0 gap-5 px-4 pt-5 sm:px-6">
    {#if stepsErrorText}
      <p class="text-xs text-destructive" role="alert">{stepsErrorText}</p>
    {/if}
    <TxBlockRootSettingsEditor
      fieldRows={rootPanel.fieldRows}
      onValueChange={editorActionHandlers.rootValueHandler}
      onPresenceChange={editorActionHandlers.rootPresenceHandler}
    />

    <Separator />

    <TxBlockRollbackPolicyEditor
      {editorDisplay}
      jsonValueTypeRows={editorDisplay.jsonValueTypeRows}
      rollbackKindRows={editorDisplay.rollbackKindRows}
      rollbackKindValue={rollbackPanel.rollbackKindValue}
      showWholeResource={rollbackPanel.showWholeResource}
      wholeResourceFieldRows={rollbackPanel.wholeResourceFieldRows}
      wholeResourceExtra={rollbackPanel.wholeResourceExtra}
      wholeResourceRollback={rollbackPanel.wholeResourceRollback}
      onRollbackKindChange={editorActionHandlers.rollbackKindValueHandler()}
      onWholeResourceFieldInput={editorActionHandlers.wholeFieldValueHandler}
      onWholeResourceFieldPresenceChange={editorActionHandlers.wholeFieldPresenceHandler}
      onWholeResourceExtraChange={editorActionHandlers.setWholeResourceExtra}
      onWholeResourceRollbackChange={editorActionHandlers.setWholeResourceRollback}
      {validationErrors}
      pathPrefix={`${pathPrefix ? `${pathPrefix}.` : ""}rollbackPolicy.wholeResource`}
    />
  </div>
</Card.Content>

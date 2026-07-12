<script>
  import { createTxBlockTemplatePromptEditorWorkspace } from "../../modules/transactionBlockTemplateWorkspaces.js";
  import TxBlockTemplatePromptPatternsEditor from "./TxBlockTemplatePromptPatternsEditor.svelte";
  import TxBlockTemplatePromptResponseEditor from "./TxBlockTemplatePromptResponseEditor.svelte";

  let {
    operation,
    prompt,
    promptRow,
    templateStepIndex,
    onChange,
    jsonValueTypeRows,
    validationErrors = [],
    pathPrefix = "",
  } = $props();
  const txBlockTemplatePromptEditorWorkspace =
    createTxBlockTemplatePromptEditorWorkspace();
  const {
    promptActionHandlersStateStore,
    promptMetadataFieldRowsStateStore,
    promptRowStateStore,
    setTemplatePromptContext,
  } = txBlockTemplatePromptEditorWorkspace;
  let syncedPromptRow = $derived($promptRowStateStore);
  let promptActionHandlers = $derived($promptActionHandlersStateStore);
  let promptMetadataFieldRows = $derived($promptMetadataFieldRowsStateStore);

  $effect(() => {
    setTemplatePromptContext({
      operation,
      prompt,
      promptRow,
      templateStepIndex,
      onChange,
    });
  });
</script>

<div class="grid gap-3 rounded-lg border border-border bg-muted/20 p-2">
  <TxBlockTemplatePromptPatternsEditor
    patternRows={syncedPromptRow.patternRows}
    onAddPattern={promptActionHandlers.addPatternAction()}
    onPatternInput={promptActionHandlers.patternValueHandler}
    onRemovePattern={promptActionHandlers.removePatternAction}
    {validationErrors}
    pathPrefix={`${pathPrefix}.patterns`}
  />
  <TxBlockTemplatePromptResponseEditor
    {prompt}
    {promptMetadataFieldRows}
    {jsonValueTypeRows}
    onResponseInput={promptActionHandlers.responseValueHandler()}
    onAppendNewlineChange={promptActionHandlers.booleanValueHandler(
      "appendNewline",
    )}
    onRecordInputChange={promptActionHandlers.booleanValueHandler(
      "recordInput",
    )}
    onDeletePrompt={promptActionHandlers.removePromptAction()}
    onExtraChange={promptActionHandlers.setExtra}
    onPromptMetadataInput={promptActionHandlers.extraMetadataValue}
    onPromptMetadataPresenceChange={promptActionHandlers.extraMetadataPresence}
  />
</div>

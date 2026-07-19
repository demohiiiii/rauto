<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import StringListEditor from "../../components/fragments/StringListEditor.svelte";
  import TextAreaField from "../../components/fragments/TextAreaField.svelte";
  import { t } from "../../lib/i18n.js";
  import { txBlockValidationErrorText } from "../../modules/transactions/transactionBlockDisplayState.js";
  import { createTxBlockCommandInteractionEditorWorkspace } from "../../modules/transactions/transactionBlockDisplays.js";

  let {
    command,
    commandDisplay,
    jsonValueTypeRows,
    onChange,
    validationErrors = [],
    pathPrefix = "",
  } = $props();
  const txBlockCommandInteractionEditorWorkspace =
    createTxBlockCommandInteractionEditorWorkspace();
  const {
    interactionActionHandlersStateStore,
    interactionDisplayStateStore,
    setInteractionEditorContext,
  } = txBlockCommandInteractionEditorWorkspace;
  let interactionActionHandlers = $derived(
    $interactionActionHandlersStateStore,
  );
  let interactionDisplay = $derived($interactionDisplayStateStore);

  $effect(() => {
    setInteractionEditorContext({
      command,
      commandDisplay,
      onChange,
    });
  });
</script>

<div class="grid gap-3">
  <div class="flex flex-wrap items-center justify-end gap-2">
    <Button
      variant="outline"
      size="sm"
      type="button"
      onclick={interactionActionHandlers.addPrompt}
    >
      {t("txBlockFormAddPrompt")}
    </Button>
  </div>
  <div class="grid gap-3">
    <div class="rounded-xl border border-border bg-card px-4 py-3">
      <span class="text-sm font-semibold text-foreground">
        {t("txBlockFormPrompts")}
      </span>
    </div>
    {#each interactionDisplay.promptRows as promptRow}
      {@const prompt = promptRow.prompt}
      {@const promptIndex = promptRow.promptIndex}
      {@const promptActionHandlers =
        interactionActionHandlers.promptActionHandlers(promptIndex)}
      {@const patternsErrorText = txBlockValidationErrorText(
        validationErrors,
        `${pathPrefix}.prompts[${promptIndex}].patterns`,
      )}
      <div
        class="grid gap-3 rounded-xl border border-border bg-card p-3 shadow-xs"
      >
        <StringListEditor
          addButtonLabel={t("addPatternInlineBtn")}
          itemRows={promptRow.patternRows}
          labelText={t("txBlockFormPatterns")}
          onAdd={promptActionHandlers.addPatternAction()}
          onRemove={promptActionHandlers.removePatternAction}
          onValueChange={promptActionHandlers.patternValueHandler}
          placeholderText={t("txBlockFormPatternsPlaceholder")}
          removeButtonLabel={t("deleteBtn")}
        />
        {#if patternsErrorText}
          <p class="text-xs text-destructive" role="alert">
            {patternsErrorText}
          </p>
        {/if}
        <div class="grid gap-2 md:grid-cols-2">
          <PresenceFieldGrid
            fieldRows={promptRow.metadataFieldRows}
            hostClass="contents"
            presenceControlsMode="hidden"
            onValueChangeForKey={promptActionHandlers.metadataValueHandler}
            onPresenceChangeForKey={promptActionHandlers.metadataPresenceHandler}
          />
          <TextAreaField
            labelText={t("txBlockFormResponse")}
            value={prompt.response}
            onInput={promptActionHandlers.textValueHandler("response")}
            class="min-h-20 font-mono"
            placeholderText={t("txBlockFormResponsePlaceholder")}
          />
          <PresenceFieldGrid
            fieldRows={promptRow.controlFieldRows}
            hostClass="contents"
            presenceControlsMode="hidden"
            onValueChange={promptActionHandlers.recordValueHandler()}
            onPresenceChangeForKey={promptActionHandlers.fieldPresenceHandler}
          />
          <Button
            class="md:col-span-2"
            variant="destructive"
            size="sm"
            type="button"
            onclick={promptActionHandlers.deletePromptAction()}
          >
            {t("deleteBtn")}
          </Button>
        </div>
        <JsonObjectFieldsEditor
          title={t("txBlockFormPromptExtra")}
          source={prompt.extra}
          typeRows={jsonValueTypeRows}
          onChange={promptActionHandlers.extraChangeHandler()}
        />
      </div>
    {/each}
    <JsonObjectFieldsEditor
      title={t("txBlockFormInteractionExtra")}
      source={command.interaction.extra}
      typeRows={jsonValueTypeRows}
      onChange={interactionActionHandlers.setInteractionExtra}
    />
  </div>
</div>

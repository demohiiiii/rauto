<script>
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button/index.js";
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import PresenceToggle from "../../components/fragments/PresenceToggle.svelte";
  import StringListEditor from "../../components/fragments/StringListEditor.svelte";
  import TextAreaField from "../../components/fragments/TextAreaField.svelte";
  import { t } from "../../lib/i18n.js";
  import TxFormSection from "./TxFormSection.svelte";
  import { createTxBlockCommandInteractionEditorWorkspace } from "../../modules/transactionBlockDisplays.js";

  let { command, commandDisplay, jsonValueTypeRows, onChange } = $props();
  const txBlockCommandInteractionEditorWorkspace =
    createTxBlockCommandInteractionEditorWorkspace();
  const {
    interactionActionHandlersStateStore,
    interactionDisplayStateStore,
    interactionMetadataFieldRowsStateStore,
    setInteractionEditorContext,
  } = txBlockCommandInteractionEditorWorkspace;
  let interactionActionHandlers = $derived(
    $interactionActionHandlersStateStore,
  );
  let interactionDisplay = $derived($interactionDisplayStateStore);
  let interactionMetadataFieldRows = $derived(
    $interactionMetadataFieldRowsStateStore,
  );

  $effect(() => {
    setInteractionEditorContext({
      command,
      commandDisplay,
      onChange,
    });
  });
</script>

<Card.Root class="rounded-2xl bg-muted/30">
  <Card.Header>
    <Card.Title class="sr-only">{t("txBlockFormInteraction")}</Card.Title>
    <div class="flex items-start justify-between gap-4">
      <TxFormSection
        class="min-w-0 flex-1"
        icon={MessageSquareIcon}
        title={t("txBlockFormInteraction")}
        description={t("txBlockFormInteractionHint")}
      />
      <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <PresenceToggle
          checked={interactionDisplay.interactionPresent}
          onChange={interactionActionHandlers.setInteractionPresence}
          labelText={interactionDisplay.interactionPresent
            ? t("enabled")
            : t("disabled")}
          showLabel={true}
        />
        <Button
          variant="outline"
          size="sm"
          type="button"
          onclick={interactionActionHandlers.addPrompt}
        >
          {t("txBlockFormAddPrompt")}
        </Button>
      </div>
    </div>
  </Card.Header>
  <Card.Content>
    {#if interactionDisplay.interactionPresent}
      <div class="grid gap-3">
        <PresenceFieldGrid
          fieldRows={interactionMetadataFieldRows}
          hostClass="grid gap-3 md:grid-cols-2"
          presenceControlsMode="advanced"
          onValueChangeForKey={interactionActionHandlers.interactionMetadataValueHandler}
          onPresenceChangeForKey={interactionActionHandlers.interactionMetadataPresenceHandler}
        />
        <div
          class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
        >
          <div class="flex flex-wrap items-center gap-3">
            <span class="text-sm font-semibold text-foreground">
              {t("txBlockFormPrompts")}
            </span>
            <PresenceToggle
              checked={interactionDisplay.promptsPresent}
              onChange={interactionActionHandlers.setPromptsPresence}
              labelText={interactionDisplay.promptsPresent
                ? t("enabled")
                : t("disabled")}
              showLabel={true}
            />
          </div>
        </div>
        {#if interactionDisplay.promptsPresent}
          {#each interactionDisplay.promptRows as promptRow}
            {@const prompt = promptRow.prompt}
            {@const promptIndex = promptRow.promptIndex}
            {@const promptActionHandlers =
              interactionActionHandlers.promptActionHandlers(promptIndex)}
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
              <div class="grid gap-2 md:grid-cols-2">
                <PresenceFieldGrid
                  fieldRows={promptRow.metadataFieldRows}
                  hostClass="contents"
                  presenceControlsMode="advanced"
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
                  presenceControlsMode="advanced"
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
        {/if}
        <JsonObjectFieldsEditor
          title={t("txBlockFormInteractionExtra")}
          source={command.interaction.extra}
          typeRows={jsonValueTypeRows}
          onChange={interactionActionHandlers.setInteractionExtra}
        />
      </div>
    {/if}
  </Card.Content>
</Card.Root>

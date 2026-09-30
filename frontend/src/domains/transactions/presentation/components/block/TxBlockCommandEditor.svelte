<script lang="ts">
  import ReadonlyFields from "$components/fragments/ReadonlyFields.svelte";
  import TemplateSourceField from "$components/fragments/TemplateSourceField.svelte";
  import { MANUAL_COMMAND_SOURCE } from "$domains/command/index.js";
  import {
    CommandEditor,
    InteractiveCommandEditor,
  } from "$domains/command/presentation/components/index.js";
  import CollapsibleGroup from "$components/fragments/CollapsibleGroup.svelte";
  import PresenceFieldGrid from "$components/fragments/PresenceFieldGrid.svelte";
  import StatusCard from "$components/fragments/StatusCard.svelte";
  import ModeExpressionField from "$components/fragments/ModeExpressionField.svelte";
  import JsonObjectFieldsEditor from "$components/fragments/JsonObjectFieldsEditor.svelte";
  import {
    createTransactionEditorPrompt,
    transactionCommandEditorModel,
    transactionCommandFromEditor,
  } from "../../../model/transactionCommandEditor.js";
  import { txBlockValidationErrorText } from "$domains/transactions/index.js";
  import { t } from "$lib/i18n.js";
  import TxBlockCommandDynParamsEditor from "$domains/transactions/presentation/components/block/TxBlockCommandDynParamsEditor.svelte";
  import { createTxBlockCommandEditorWorkspace } from "$domains/transactions/index.js";
  import type {
    TxCommandModel,
    TxMetadataFieldDefinition,
    TxValidationError,
  } from "$domains/transactions/index.js";

  interface Props {
    command: TxCommandModel;
    interactive?: boolean;
    jsonValueTypeRows: readonly string[];
    metadataFieldDefs?: readonly TxMetadataFieldDefinition[];
    onChange?: (patch: Partial<TxCommandModel>) => void;
    pathPrefix?: string;
    validationErrors?: readonly TxValidationError[];
  }

  let {
    command,
    interactive = false,
    onChange,
    jsonValueTypeRows,
    metadataFieldDefs = [],
    validationErrors = [],
    pathPrefix = "",
  }: Props = $props();
  const txBlockCommandEditorWorkspace = createTxBlockCommandEditorWorkspace();
  const {
    commandActionHandlersStateStore,
    commandDisplayStateStore,
    commandTemplateSourceStateStore,
    destroy,
    initializeCommandTemplates,
    metadataFieldRowsStateStore,
    setCommandEditorContext,
    selectCommandTemplate,
  } = txBlockCommandEditorWorkspace;
  let commandActionHandlers = $derived($commandActionHandlersStateStore);
  let commandDisplay = $derived($commandDisplayStateStore);
  let commandTemplateSource = $derived($commandTemplateSourceStateStore);
  let metadataFieldRows = $derived($metadataFieldRowsStateStore);

  $effect(() => {
    setCommandEditorContext({
      command,
      metadataFieldDefs,
      onChange,
      validationErrors,
      pathPrefix,
    });
  });

  $effect(() => destroy);

  $effect(() => {
    void initializeCommandTemplates();
  });

  function commandScopeKey(suffix: string): string {
    return `tx-block-command-${pathPrefix || "operation"}-${suffix}`;
  }

  let dynParamCount = $derived(commandDisplay.dynParamExtraRows.length);
  let sharedModel = $derived(transactionCommandEditorModel(command));
  let modeFieldRow = $derived(
    commandDisplay.fieldRows.find((row) => row.fieldKey === "mode"),
  );
  let commandError = $derived(
    txBlockValidationErrorText(validationErrors, `${pathPrefix}.command`),
  );
  let compactFieldRows = $derived(
    commandDisplay.fieldRows.filter(
      (fieldRow) => !["command", "mode"].includes(fieldRow.fieldKey),
    ),
  );
</script>

{#snippet modeField()}
  <div class="grid min-w-0 gap-1">
    <ModeExpressionField
      title={t("modePlaceholder")}
      aria-label={t("modePlaceholder")}
      value={command.mode}
      optionValues={modeFieldRow && "optionValues" in modeFieldRow
        ? modeFieldRow.optionValues
        : []}
      placeholderText={t("modePlaceholder")}
      onValueChange={(mode) => onChange?.({ mode })}
    />
    {#if modeFieldRow?.errorText}
      <p class="text-xs text-destructive" role="alert">
        {modeFieldRow.errorText}
      </p>
    {/if}
  </div>
{/snippet}
{#snippet settings()}
  <PresenceFieldGrid
    fieldRows={compactFieldRows}
    valueHandlerMode="event"
    hostClass="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-3"
    presenceControlsMode="hidden"
    onValueChangeForKey={commandActionHandlers.fieldValueHandler}
    onPresenceChangeForKey={commandActionHandlers.fieldPresenceHandler}
  />
  <PresenceFieldGrid
    fieldRows={metadataFieldRows}
    valueHandlerMode="event"
    hostClass="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-3"
    presenceControlsMode="hidden"
    onValueChangeForKey={commandActionHandlers.metadataValueHandler}
    onPresenceChangeForKey={commandActionHandlers.metadataPresenceHandler}
  />
{/snippet}

<div class="grid min-w-0 gap-3">
  <ReadonlyFields class="grid min-w-0 gap-4">
    <TemplateSourceField
      manualValue={MANUAL_COMMAND_SOURCE}
      value={commandTemplateSource.selection}
      optionValues={commandTemplateSource.optionValues}
      disabled={commandTemplateSource.loading}
      onValueChange={selectCommandTemplate}
    />

    {#if commandTemplateSource.statusMessage}
      <StatusCard
        message={commandTemplateSource.statusMessage}
        tone={commandTemplateSource.statusTone}
      />
    {/if}
    {#if interactive}
      <InteractiveCommandEditor
        {modeField}
        {settings}
        compact={true}
        step={sharedModel}
        createPrompt={createTransactionEditorPrompt}
        onChange={(editor) =>
          onChange?.(transactionCommandFromEditor(command, editor))}
      >
        {#snippet promptDetails(prompt, index, updatePrompt)}
          {@const error = txBlockValidationErrorText(
            validationErrors,
            `${pathPrefix}.interaction.prompts[${index}].patterns`,
          )}
          {#if error}<p class="px-3 pb-3 text-xs text-destructive" role="alert">
              {error}
            </p>{/if}
          {#if Object.keys(prompt.extra).length > 0}
            <div class="px-3 pb-3">
              <JsonObjectFieldsEditor
                title={t("txBlockFormPromptExtra")}
                source={prompt.extra}
                typeRows={[...jsonValueTypeRows]}
                onChange={(extra) => updatePrompt({ ...prompt, extra })}
              />
            </div>
          {/if}
        {/snippet}
      </InteractiveCommandEditor>
    {:else}
      <CommandEditor
        command={command.command}
        multilineMode={command.multilineMode}
        commandLabel={t("fieldCommand")}
        {modeField}
        onCommandChange={(command) => onChange?.({ command })}
        onMultilineModeChange={(multilineMode) => onChange?.({ multilineMode })}
      >
        {@render settings()}
      </CommandEditor>
    {/if}
    {#if commandError}<p class="text-xs text-destructive" role="alert">
        {commandError}
      </p>{/if}
  </ReadonlyFields>
  <CollapsibleGroup
    variant="section"
    class=""
    label={t("txBlockFormDynParams")}
    persistenceKey={commandScopeKey("dynamic")}
    body-class="pt-3"
  >
    {#snippet header()}
      <div class="min-w-0 flex-1">
        <div class="text-sm font-semibold text-foreground">
          {t("txBlockFormDynParams")}
        </div>
        <div class="text-xs text-muted-foreground">{dynParamCount}</div>
      </div>
    {/snippet}

    <ReadonlyFields>
      <TxBlockCommandDynParamsEditor {command} {commandDisplay} {onChange} />
    </ReadonlyFields>
  </CollapsibleGroup>
  {#if Object.keys(command.interaction.extra).length > 0}
    <ReadonlyFields>
      <JsonObjectFieldsEditor
        title={t("txBlockFormInteractionExtra")}
        source={command.interaction.extra}
        typeRows={[...jsonValueTypeRows]}
        onChange={(extra) =>
          onChange?.({ interaction: { ...command.interaction, extra } })}
      />
    </ReadonlyFields>
  {/if}
</div>

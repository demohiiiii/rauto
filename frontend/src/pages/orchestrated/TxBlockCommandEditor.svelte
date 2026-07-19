<script>
  import TerminalIcon from "@lucide/svelte/icons/terminal";
  import {
    CommandEditor,
    CommandTemplateSourceField,
  } from "../../components/command-flow/index.js";
  import CollapsibleGroup from "../../components/fragments/CollapsibleGroup.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import { t } from "../../lib/i18n.js";
  import TxBlockCommandDynParamsEditor from "./TxBlockCommandDynParamsEditor.svelte";
  import TxBlockCommandInteractionEditor from "./TxBlockCommandInteractionEditor.svelte";
  import TxFormSection from "./TxFormSection.svelte";
  import { createTxBlockCommandEditorWorkspace } from "../../modules/transactions/transactionBlockDisplays.js";

  let {
    command,
    onChange,
    jsonValueTypeRows,
    metadataFieldDefs = [],
    validationErrors = [],
    pathPrefix = "",
  } = $props();
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

  function commandScopeKey(suffix) {
    return `tx-block-command-${pathPrefix || "operation"}-${suffix}`;
  }

  let dynParamCount = $derived(commandDisplay.dynParamExtraRows.length);
  let promptCount = $derived(commandDisplay.promptRows.length);
  let compactFieldRows = $derived(
    commandDisplay.fieldRows.filter(
      (fieldRow) => fieldRow.fieldKey !== "command",
    ),
  );
</script>

<div class="grid gap-3">
  <TxFormSection
    icon={TerminalIcon}
    title={t("txBlockFormCommand")}
    description={t("txBlockFormCommandHint")}
  >
    <CommandTemplateSourceField
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
    <CommandEditor
      command={command.command || ""}
      multilineMode={command.multilineMode || "split_lines"}
      placeholderText={t("txBlockFormCommandPlaceholder")}
      onCommandChange={(commandText) => onChange?.({ command: commandText })}
      onMultilineModeChange={(multilineMode) => onChange?.({ multilineMode })}
    >
      <PresenceFieldGrid
        fieldRows={compactFieldRows}
        valueHandlerMode="event"
        hostClass="grid gap-3 md:grid-cols-2"
        presenceControlsMode="hidden"
        onValueChangeForKey={commandActionHandlers.fieldValueHandler}
        onPresenceChangeForKey={commandActionHandlers.fieldPresenceHandler}
      />
      <PresenceFieldGrid
        fieldRows={metadataFieldRows}
        valueHandlerMode="event"
        hostClass="grid gap-3 md:grid-cols-2"
        presenceControlsMode="hidden"
        onValueChangeForKey={commandActionHandlers.metadataValueHandler}
        onPresenceChangeForKey={commandActionHandlers.metadataPresenceHandler}
      />
    </CommandEditor>
  </TxFormSection>
  <CollapsibleGroup
    variant="section"
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
    <TxBlockCommandDynParamsEditor {command} {commandDisplay} {onChange} />
  </CollapsibleGroup>
  <CollapsibleGroup
    variant="section"
    label={t("txBlockFormInteraction")}
    persistenceKey={commandScopeKey("interaction")}
    body-class="pt-3"
  >
    {#snippet header()}
      <div class="min-w-0 flex-1">
        <div class="text-sm font-semibold text-foreground">
          {t("txBlockFormInteraction")}
        </div>
        <div class="text-xs text-muted-foreground">
          {commandDisplay.interactionDisplay.interactionPresent
            ? `${t("enabled")} · ${promptCount}`
            : t("disabled")}
        </div>
      </div>
    {/snippet}
    <TxBlockCommandInteractionEditor
      {command}
      {commandDisplay}
      {jsonValueTypeRows}
      {onChange}
      {validationErrors}
      pathPrefix={`${pathPrefix}.interaction`}
    />
  </CollapsibleGroup>
</div>

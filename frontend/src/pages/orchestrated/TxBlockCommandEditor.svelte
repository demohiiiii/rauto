<script>
  import TerminalIcon from "@lucide/svelte/icons/terminal";
  import CollapsibleGroup from "../../components/fragments/CollapsibleGroup.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import { t } from "../../lib/i18n.js";
  import TxBlockCommandDynParamsEditor from "./TxBlockCommandDynParamsEditor.svelte";
  import TxBlockCommandInteractionEditor from "./TxBlockCommandInteractionEditor.svelte";
  import TxFormSection from "./TxFormSection.svelte";
  import { createTxBlockCommandEditorWorkspace } from "../../modules/transactionBlockDisplays.js";

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
    metadataFieldRowsStateStore,
    setCommandEditorContext,
  } = txBlockCommandEditorWorkspace;
  let commandActionHandlers = $derived($commandActionHandlersStateStore);
  let commandDisplay = $derived($commandDisplayStateStore);
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

  function commandScopeKey(suffix) {
    return `tx-block-command-${pathPrefix || "operation"}-${suffix}`;
  }

  let dynParamCount = $derived(
    commandDisplay.dynParamExtraRows.length +
      Number(commandDisplay.dynParamEnablePasswordPresent) +
      Number(commandDisplay.dynParamSudoPasswordPresent),
  );
  let promptCount = $derived(commandDisplay.promptRows.length);
</script>

<div class="grid gap-3">
  <TxFormSection
    icon={TerminalIcon}
    title={t("txBlockFormCommand")}
    description={t("txBlockFormCommandHint")}
  >
    <PresenceFieldGrid
      fieldRows={commandDisplay.fieldRows}
      valueHandlerMode="event"
      hostClass="grid gap-3 md:grid-cols-3"
      itemClassByFieldKey={{ command: "md:col-span-2" }}
      controlClassByFieldKey={{ command: "font-mono" }}
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

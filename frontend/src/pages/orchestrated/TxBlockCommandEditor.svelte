<script>
  import TerminalIcon from "@lucide/svelte/icons/terminal";
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
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
    setCommandEditorContext({ command, metadataFieldDefs, onChange });
  });
</script>

<div class="grid gap-3">
  <TxFormSection
    icon={TerminalIcon}
    title={t("txBlockFormCommand")}
    description={t("txBlockFormCommandHint")}
  >
    <PresenceFieldGrid
      fieldRows={commandDisplay.fieldRows}
      hostClass="grid gap-3 md:grid-cols-3"
      itemClassByFieldKey={{ command: "md:col-span-2" }}
      controlClassByFieldKey={{ command: "font-mono" }}
      presenceControlsMode="advanced"
      onValueChangeForKey={commandActionHandlers.fieldValueHandler}
      onPresenceChangeForKey={commandActionHandlers.fieldPresenceHandler}
    />
    <PresenceFieldGrid
      fieldRows={metadataFieldRows}
      hostClass="grid gap-3 md:grid-cols-2"
      presenceControlsMode="advanced"
      onValueChangeForKey={commandActionHandlers.metadataValueHandler}
      onPresenceChangeForKey={commandActionHandlers.metadataPresenceHandler}
    />
  </TxFormSection>
  <JsonObjectFieldsEditor
    title={t("txBlockFormCommandExtra")}
    source={command.extra}
    typeRows={jsonValueTypeRows}
    onChange={commandActionHandlers.setExtra}
  />
  <TxBlockCommandDynParamsEditor {command} {commandDisplay} {onChange} />
  <TxBlockCommandInteractionEditor
    {command}
    {commandDisplay}
    {jsonValueTypeRows}
    {onChange}
  />
</div>

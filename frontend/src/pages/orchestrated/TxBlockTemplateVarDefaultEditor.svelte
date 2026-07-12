<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import PlainTextAreaField from "../../components/fragments/PlainTextAreaField.svelte";
  import StringSelectField from "../../components/fragments/StringSelectField.svelte";
  import { t } from "../../lib/i18n.js";
  import { valueEditorPresentation } from "../../lib/objectFields.js";
  import { createTxBlockTemplateVarDefaultEditorWorkspace } from "../../modules/transactionBlockTemplateWorkspaces.js";

  let { operation, variableRow, onChange, jsonValueTypeRows } = $props();
  const txBlockTemplateVarDefaultEditorWorkspace =
    createTxBlockTemplateVarDefaultEditorWorkspace();
  const {
    defaultActionHandlersStateStore,
    defaultRowsStateStore,
    setTemplateVarDefaultContext,
    variableStateStore,
  } = txBlockTemplateVarDefaultEditorWorkspace;
  let variable = $derived($variableStateStore);
  let defaultRows = $derived($defaultRowsStateStore);
  let defaultActionHandlers = $derived($defaultActionHandlersStateStore);

  $effect(() => {
    setTemplateVarDefaultContext({ operation, variableRow, onChange });
  });
</script>

<div class="grid gap-2 rounded-lg bg-slate-50 p-2 md:col-span-2">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <span>{t("txBlockFormDefaultPlaceholder")}</span>
    {#if defaultRows.length === 0}
      <Button
        variant="outline"
        size="xs"
        type="button"
        onclick={defaultActionHandlers.addDefault}
      >
        {t("txBlockFormAddVar")}
      </Button>
    {/if}
  </div>
  {#each defaultRows as defaultRow}
    {@const defaultEditorDisplay = valueEditorPresentation(
      defaultRow.typeValue,
      defaultRow.valueText,
    )}
    <div class="grid gap-2 md:grid-cols-[8rem_1fr_auto]">
      <StringSelectField
        value={defaultEditorDisplay.typeValue}
        optionValues={jsonValueTypeRows}
        onChange={defaultActionHandlers.defaultTypeHandler()}
      />
      {#if defaultEditorDisplay.showObjectEditor}
        <JsonObjectFieldsEditor
          title={t("txBlockFormDefaultPlaceholder")}
          source={defaultEditorDisplay.objectSource}
          typeRows={jsonValueTypeRows}
          onChange={defaultActionHandlers.defaultObjectValueHandler()}
        />
      {:else if defaultEditorDisplay.editorKind === "textarea"}
        <PlainTextAreaField
          class="min-h-28 font-mono"
          value={defaultEditorDisplay.valueText}
          title={defaultEditorDisplay.valueText}
          onInput={defaultActionHandlers.defaultValueHandler()}
          disabled={defaultEditorDisplay.disabled}
        />
      {:else}
        <PlainInputField
          class="font-mono"
          value={defaultEditorDisplay.valueText}
          onInput={defaultActionHandlers.defaultValueHandler()}
          disabled={defaultEditorDisplay.disabled}
        />
      {/if}
      <Button
        variant="destructive"
        size="xs"
        type="button"
        onclick={defaultActionHandlers.clearDefault}
      >
        {t("deleteBtn")}
      </Button>
    </div>
  {/each}
</div>

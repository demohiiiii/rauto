<script>
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import { t } from "../../lib/i18n.js";
  import { createTxWorkflowTemplateRefEditorWorkspace } from "../../modules/transactions/transactionWorkflowEditors.js";
  import TxWorkflowTemplateRefSourceEditor from "./TxWorkflowTemplateRefSourceEditor.svelte";
  import TxWorkflowTemplateRefVarsEditor from "./TxWorkflowTemplateRefVarsEditor.svelte";

  let {
    templateRef,
    booleanRows = [],
    jsonValueTypeRows = [],
    bindings,
  } = $props();

  const txWorkflowTemplateRefEditorWorkspace =
    createTxWorkflowTemplateRefEditorWorkspace();
  const {
    editorDisplayStateStore: templateRefEditorDisplayStateStore,
    setTemplateRefEditorContext,
  } = txWorkflowTemplateRefEditorWorkspace;
  let editorDisplayStateStore = $derived(templateRefEditorDisplayStateStore);
  let editorDisplay = $derived($editorDisplayStateStore);

  $effect(() => {
    setTemplateRefEditorContext({
      booleanRows,
      templateRef,
    });
  });
</script>

<div class="grid gap-4">
  <div class="grid gap-3 md:grid-cols-2">
    <PresenceFieldGrid
      fieldRows={editorDisplay.fieldRows}
      hostClass="contents"
      onValueChangeForKey={bindings.valueHandler}
      onNullableModeChangeForKey={bindings.nullableModeHandler}
      onPresenceChangeForKey={bindings.presenceToggle}
    />
  </div>

  <TxWorkflowTemplateRefSourceEditor
    sourceDisplay={editorDisplay.sourceDisplay}
    onSourceModeChange={bindings.sourceModeHandler()}
    onSourceFieldPresenceChange={bindings.presenceToggle(
      editorDisplay.sourceDisplay.sourceField.fieldKey,
    )}
    onTemplateContentChange={bindings.templateContentHandler()}
    onTemplateContentModeChange={bindings.templateContentModeHandler()}
    onTemplateNameChange={bindings.templateNameHandler()}
    onTemplateNameModeChange={bindings.templateNameModeHandler()}
  />

  <TxWorkflowTemplateRefVarsEditor
    varsDisplay={editorDisplay.varsDisplay}
    {jsonValueTypeRows}
    onVarsChange={bindings.setTemplateVars}
    onVarsPresenceChange={bindings.varsToggle()}
  />

  <JsonObjectFieldsEditor
    title={t("txWorkflowFormBlockTemplateExtra")}
    source={editorDisplay.extraSource}
    typeRows={jsonValueTypeRows}
    onChange={bindings.setExtra}
  />
</div>

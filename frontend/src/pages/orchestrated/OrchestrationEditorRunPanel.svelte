<script>
  import { tick } from "svelte";
  import {
    listInventoryGroups,
    listInventoryLabels,
  } from "../../api/client.js";
  import { browserConfirm } from "../../lib/browser.js";
  import { t } from "../../lib/i18n.js";
  import {
    createOrchestrationEditorPanelWorkspace,
    orchestrationJsonPlaceholder,
  } from "../../modules/orchestration/orchestrationPanelState.js";
  import { orchestrationPlanFormModelFromJsonText } from "../../modules/orchestration/orchestrationFormState.js";
  import { setConnectionInventorySnapshots } from "../../modules/connections/connectionFields.js";
  import { createOrchestrationTemplateWorkspace } from "../../modules/orchestration/orchestrationTemplateWorkspace.js";
  import OrchestrationEditorSurface from "./OrchestrationEditorSurface.svelte";

  let {
    active,
    onEditorInput,
    onExecute,
    onImportFile,
    orchestrationEditorRunButtonDisplay,
    editorSyncVersion = 0,
    executionPanelDisplay,
  } = $props();

  const orchestrationEditorWorkspace =
    createOrchestrationEditorPanelWorkspace();
  const {
    changeFormModel,
    createJsonDraft,
    editorDisplayStateStore,
    ensureInitialized,
    formErrorStateStore,
    formModelStateStore,
    handleEditorJsonInput,
    importFile,
    jsonTextStateStore,
    setEditorPanelContext,
    setFormError,
    visualDisplayStateStore,
  } = orchestrationEditorWorkspace;
  let editorDisplay = $derived($editorDisplayStateStore);
  let orchestrationFormModel = $derived($formModelStateStore);
  let orchestrationFormError = $derived($formErrorStateStore);
  let orchestrationJsonText = $derived($jsonTextStateStore);
  let visualDisplay = $derived($visualDisplayStateStore);
  let templateInitialized = false;
  let targetOptionsInitialized = false;

  async function initializeTargetOptions() {
    const [groups, labels] = await Promise.all([
      listInventoryGroups().catch(() => []),
      listInventoryLabels().catch(() => []),
    ]);
    setConnectionInventorySnapshots({
      groups: Array.isArray(groups) ? groups : [],
      labels: Array.isArray(labels) ? labels : [],
    });
  }

  function confirmTemplateReplacement({ reason } = {}) {
    return browserConfirm(
      t(
        reason === "delete"
          ? "orchestrationTemplateDeleteConfirm"
          : "orchestrationDiscardChangesConfirm",
      ),
    );
  }

  function changeCurrentFormModel(nextModel, options) {
    const result = changeFormModel(nextModel, options);
    orchestrationTemplateWorkspace.markEdited();
    return result;
  }

  function handleCurrentEditorInput(jsonText) {
    const result = handleEditorJsonInput(jsonText);
    orchestrationTemplateWorkspace.markEdited();
    return result;
  }

  function replaceTemplateJson(jsonText) {
    const parsed = orchestrationPlanFormModelFromJsonText(jsonText);
    if (parsed.error || !parsed.model) {
      throw new Error(parsed.error || t("orchestrationJsonRequired"));
    }
    return handleCurrentEditorInput(jsonText);
  }

  const orchestrationTemplateWorkspace = createOrchestrationTemplateWorkspace({
    confirmReplace: confirmTemplateReplacement,
    createDraft: createJsonDraft,
    getCurrentJson: () => orchestrationJsonText,
    replaceJson: replaceTemplateJson,
  });
  const {
    adoptManualSnapshot,
    changeNameDialogValue,
    closeNameDialog,
    displayStateStore: templateDisplayStateStore,
    initialize: initializeTemplates,
    openNewDialog,
    openSaveAsDialog,
    saveTemplate,
    selectTemplate,
    submitNameDialog,
  } = orchestrationTemplateWorkspace;
  let templateDisplay = $derived($templateDisplayStateStore);

  async function importManualFile(file) {
    if (
      templateDisplay.dirty &&
      !browserConfirm(t("orchestrationDiscardChangesConfirm"))
    ) {
      return false;
    }
    const result = await importFile(file);
    await tick();
    adoptManualSnapshot({ statusKind: "imported" });
    return result;
  }

  $effect(() => {
    setEditorPanelContext({
      editorSyncVersion,
      jsonPlaceholder: orchestrationJsonPlaceholder,
      onCreateDraft: null,
      onEditorInput,
      onImportFile,
    });
    ensureInitialized();
  });

  $effect(() => {
    if (!active || templateInitialized) return;
    templateInitialized = true;
    void initializeTemplates();
  });

  $effect(() => {
    if (!active || targetOptionsInitialized) return;
    targetOptionsInitialized = true;
    void initializeTargetOptions();
  });
</script>

<OrchestrationEditorSurface
  {active}
  {editorDisplay}
  editorValue={orchestrationJsonText}
  {orchestrationFormError}
  {orchestrationFormModel}
  {visualDisplay}
  onFormChange={changeCurrentFormModel}
  onEditorErrorChange={setFormError}
  onEditorInput={handleCurrentEditorInput}
  {onExecute}
  onImportFile={importManualFile}
  {templateDisplay}
  onTemplateChange={selectTemplate}
  {openNewDialog}
  {saveTemplate}
  {openSaveAsDialog}
  {changeNameDialogValue}
  {closeNameDialog}
  {submitNameDialog}
  runButtonDisplay={orchestrationEditorRunButtonDisplay}
  {executionPanelDisplay}
/>

<script>
  import { Badge } from "$lib/components/ui/badge/index.js";
  import * as Card from "$lib/components/ui/card";
  import { CommandTemplateSourceField } from "../../components/command-flow/index.js";
  import WorkspaceActionHeader from "../../components/fragments/WorkspaceActionHeader.svelte";
  import WorkspaceTemplateActions from "../../components/fragments/WorkspaceTemplateActions.svelte";
  import { txBlockReadonlyEditorViewTabs } from "../../config/dashboardModes.js";
  import { currentLanguageState, t } from "../../lib/i18n.js";
  import { MANUAL_COMMAND_SOURCE } from "../../modules/command/commandTemplateCatalog.js";
  import {
    transactionEditorSyncPresentation,
    txBlockVarsPlaceholder,
  } from "../../modules/transactions/transactionInputState.js";
  import TxDirectVarsPanel from "./TxDirectVarsPanel.svelte";
  import TxJsonFormSurface from "./TxJsonFormSurface.svelte";
  import TxBlockVisualEditor from "./TxBlockVisualEditor.svelte";
  import TxBlockPreviewPanel from "./TxBlockPreviewPanel.svelte";
  import { createTxBlockInputPanelWorkspace } from "../../modules/transactions/transactionInputWorkspaces.js";
  import { txBlockFormModelToJsonText } from "../../modules/transactions/transactionBlockFormModels.js";
  import { txBlockPreviewPresentation } from "../../modules/transactions/transactionExecutionDisplays.js";

  import {
    TX_TEMPLATE_KIND,
    TX_VARS,
    jsonTemplateSelectStateFor,
    setJsonTemplateSelectValue,
  } from "../../modules/transactions/transactionPanelState.js";

  let {
    active,
    onCreateJsonTemplateDraft,
    onEditorInput,
    onImportFile,
    onLoadJsonTemplate,
    onSaveJsonTemplate,
    newButtonLabelKey,
  } = $props();

  const directVarsKey = TX_VARS.txBlockDirect;
  const txBlockTemplateSelectStateStore = jsonTemplateSelectStateFor(
    TX_TEMPLATE_KIND.txBlock,
  );
  const txBlockInputWorkspace = createTxBlockInputPanelWorkspace();
  const {
    changeFormModel,
    createJsonDraft,
    editorDisplayStateStore,
    editorDisplayModeStateStore,
    ensureInitialized,
    formErrorDetailStateStore,
    formErrorStateStore,
    formModelStateStore,
    handleEditorJsonInput,
    jsonTextStateStore,
    loadJsonTemplate,
    loadingKeysStore,
    panelDisplayStateStore,
    resetDraft,
    setBlockInputPanelContext,
    selectEditorView,
    syncStatusStateStore,
  } = txBlockInputWorkspace;
  let currentLanguage = $derived($currentLanguageState);
  let txBlockInputDisplay = $derived($panelDisplayStateStore);
  let txBlockEditorDisplay = $derived($editorDisplayStateStore);
  let editorDisplayMode = $derived($editorDisplayModeStateStore);
  let txBlockFormModel = $derived($formModelStateStore);
  let txBlockFormError = $derived($formErrorStateStore);
  let txBlockFormErrorDetail = $derived($formErrorDetailStateStore);
  let txBlockJsonText = $derived($jsonTextStateStore);
  let txBlockSyncStatus = $derived($syncStatusStateStore);
  let txBlockTemplateSelectState = $derived($txBlockTemplateSelectStateStore);
  let txBlockSourceSelection = $state(MANUAL_COMMAND_SOURCE);
  let txBlockSourceLoading = $state(false);
  let templateAction = $state("");
  let txBlockSourceOptions = $derived(
    Array.isArray(txBlockTemplateSelectState?.names)
      ? txBlockTemplateSelectState.names
      : [],
  );
  let txBlockSyncPresentation = $derived.by(() => {
    currentLanguage;
    return transactionEditorSyncPresentation(txBlockSyncStatus);
  });
  let txBlockReadonlyPreview = $derived.by(() => {
    currentLanguage;
    return txBlockPreviewPresentation(
      JSON.parse(txBlockFormModelToJsonText(txBlockFormModel)),
      null,
    );
  });
  let jsonNewLoading = $derived($loadingKeysStore.includes("json-new"));

  function resetTxBlockSourceSelection() {
    setJsonTemplateSelectValue(TX_TEMPLATE_KIND.txBlock, "");
    txBlockSourceSelection = MANUAL_COMMAND_SOURCE;
  }

  async function createManualTxBlockDraft() {
    const result = resetDraft();
    resetTxBlockSourceSelection();
    return result;
  }

  async function importManualTxBlock(file) {
    const result = await onImportFile?.(file);
    resetTxBlockSourceSelection();
    return result;
  }

  async function runTemplateAction(action, operation) {
    if (templateAction) return false;
    templateAction = action;
    try {
      const result = await operation?.();
      await Promise.resolve();
      const selectedName = String(
        $txBlockTemplateSelectStateStore?.selected || "",
      ).trim();
      if (selectedName) txBlockSourceSelection = selectedName;
      return result;
    } finally {
      templateAction = "";
    }
  }

  async function selectTxBlockSource(sourceValue) {
    const nextSource =
      String(sourceValue || "").trim() || MANUAL_COMMAND_SOURCE;
    if (nextSource === txBlockSourceSelection) return true;
    txBlockSourceLoading = true;
    try {
      if (nextSource === MANUAL_COMMAND_SOURCE) {
        await createManualTxBlockDraft();
        return true;
      }
      const loadedTemplate = await loadJsonTemplate(nextSource);
      if (!loadedTemplate) return false;
      txBlockSourceSelection = nextSource;
      return true;
    } finally {
      txBlockSourceLoading = false;
    }
  }

  $effect(() => {
    setBlockInputPanelContext({
      newButtonLabelKey,
      onCreateJsonTemplateDraft,
      onEditorInput,
      onLoadJsonTemplate,
    });
    ensureInitialized();
  });
</script>

<div class="grid gap-2">
  <Card.Root class="gap-0 overflow-hidden py-0">
    <WorkspaceActionHeader
      title={txBlockInputDisplay.editorTitle}
      description={txBlockInputDisplay.directHint}
    >
      {#snippet status()}
        <Badge variant="secondary">
          {txBlockSourceSelection === MANUAL_COMMAND_SOURCE
            ? t("txBlockSourceManual")
            : t("orchestrationTemplateSavedTemplate")}
        </Badge>
        {#if txBlockSourceSelection !== MANUAL_COMMAND_SOURCE}
          <Badge variant="outline">{txBlockSourceSelection}</Badge>
        {/if}
      {/snippet}
      {#snippet actions()}
        <WorkspaceTemplateActions
          busy={!!templateAction || txBlockSourceLoading}
          canSave={txBlockSourceSelection !== MANUAL_COMMAND_SOURCE}
          loadingAction={templateAction || (jsonNewLoading ? "new" : "")}
          onNew={() => runTemplateAction("new", createManualTxBlockDraft)}
          onSave={() => runTemplateAction("save", onSaveJsonTemplate)}
          onSaveAs={() =>
            runTemplateAction("save_as", onCreateJsonTemplateDraft)}
          onImport={importManualTxBlock}
        />
      {/snippet}
    </WorkspaceActionHeader>
    <Card.Content class="grid gap-4 p-4 sm:p-5">
      <CommandTemplateSourceField
        value={txBlockSourceSelection}
        optionValues={txBlockSourceOptions}
        disabled={txBlockSourceLoading}
        labelText={t("txBlockSourceLabel")}
        hintText={t("txBlockSourceHint")}
        manualLabelText={t("txBlockSourceManual")}
        onValueChange={selectTxBlockSource}
      />
      <TxDirectVarsPanel
        {active}
        hidden-textarea={false}
        hintKey="txBlockDirectVarsHint"
        placeholderFallback={txBlockVarsPlaceholder}
        placeholderKey="txBlockDirectVarsPlaceholder"
        prefix="tx-block-direct"
        varsKey={directVarsKey}
      />
      <TxJsonFormSurface
        {active}
        {editorDisplayMode}
        editorKey={txBlockEditorDisplay.editorKey}
        editorValue={txBlockJsonText}
        editorTitle={txBlockEditorDisplay.editorTitle}
        formError={txBlockFormError}
        formErrorDetail={txBlockFormErrorDetail}
        hostClass={txBlockEditorDisplay.hostClass}
        jsonHintText={txBlockEditorDisplay.jsonHintText}
        onEditorInput={handleEditorJsonInput}
        onEditorViewSelect={selectEditorView}
        placeholder={txBlockEditorDisplay.placeholder}
        syncStatus={txBlockSyncStatus}
        syncStatusText={txBlockSyncPresentation.text}
        syncStatusTone={txBlockSyncPresentation.tone}
        tabItems={txBlockReadonlyEditorViewTabs}
      >
        {#snippet formContent()}
          <TxBlockVisualEditor
            model={txBlockFormModel}
            onChange={changeFormModel}
          />
        {/snippet}
        {#snippet readonlyContent()}
          <TxBlockPreviewPanel
            previewPresentation={txBlockReadonlyPreview}
            showResult={false}
            showSummary={true}
          />
        {/snippet}
      </TxJsonFormSurface>
    </Card.Content>
  </Card.Root>
</div>

<script>
  import * as Card from "$lib/components/ui/card";
  import { CommandTemplateSourceField } from "../../components/command-flow/index.js";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import { txBlockReadonlyEditorViewTabs } from "../../config/dashboardModes.js";
  import { currentLanguageState, t } from "../../lib/i18n.js";
  import { MANUAL_COMMAND_SOURCE } from "../../modules/commandTemplateCatalog.js";
  import TxDirectVarsPanel from "./TxDirectVarsPanel.svelte";
  import TxJsonFormSurface from "./TxJsonFormSurface.svelte";
  import TxBlockVisualEditor from "./TxBlockVisualEditor.svelte";
  import TxBlockPreviewPanel from "./TxBlockPreviewPanel.svelte";
  import {
    createTxBlockInputPanelWorkspace,
    transactionEditorSyncPresentation,
    txBlockVarsPlaceholder,
  } from "../../modules/transactionInputWorkspaces.js";
  import { txBlockFormModelToJsonText } from "../../modules/transactionBlockFormModels.js";
  import { txBlockPreviewPresentation } from "../../modules/transactionExecutionDisplays.js";

  import {
    TX_TEMPLATE_KIND,
    TX_VARS,
    jsonTemplateSelectStateFor,
    setJsonTemplateSelectValue,
  } from "../../modules/transactionPanelState.js";

  let {
    active,
    onCreateJsonTemplateDraft,
    onEditorInput,
    onLoadJsonTemplate,
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
    const result = await createJsonDraft();
    resetTxBlockSourceSelection();
    return result;
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
  <Card.Root>
    <Card.Header>
      <Card.Title>{txBlockInputDisplay.editorTitle}</Card.Title>
      <Card.Description>{txBlockInputDisplay.directHint}</Card.Description>
      <Card.Action>
        <div class="inline-flex flex-wrap items-center gap-2">
          <LoadingButton
            size="sm"
            loading={jsonNewLoading}
            onclick={createManualTxBlockDraft}
          >
            <span>{txBlockInputDisplay.newButtonLabel}</span>
          </LoadingButton>
        </div>
      </Card.Action>
    </Card.Header>
    <Card.Content class="grid gap-4">
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

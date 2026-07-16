<script>
  import BracesIcon from "@lucide/svelte/icons/braces";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import * as Card from "$lib/components/ui/card";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { CommandTemplateSourceField } from "../../components/command-flow/index.js";
  import FilePickerButton from "../../components/fragments/FilePickerButton.svelte";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import { currentLanguageState, t } from "../../lib/i18n.js";
  import { MANUAL_COMMAND_SOURCE } from "../../modules/commandTemplateCatalog.js";
  import TxDirectVarsPanel from "./TxDirectVarsPanel.svelte";
  import TxJsonFormSurface from "./TxJsonFormSurface.svelte";
  import TxWorkflowPreviewPanel from "./TxWorkflowPreviewPanel.svelte";
  import TxWorkflowVisualEditor from "./TxWorkflowVisualEditor.svelte";
  import {
    createTxWorkflowInputPanelWorkspace,
    transactionEditorSyncPresentation,
    txWorkflowVarsPlaceholder,
  } from "../../modules/transactionInputWorkspaces.js";
  import { txWorkflowFormModelToJsonText } from "../../modules/transactionWorkflowFormModels.js";
  import { txWorkflowPreviewPresentation } from "../../modules/transactionExecutionDisplays.js";

  import {
    TX_TEMPLATE_KIND,
    TX_VARS,
    jsonTemplateSelectStateFor,
    setJsonTemplateSelectValue,
  } from "../../modules/transactionPanelState.js";

  let {
    active,
    jsonNewLoading,
    onCreateDirectDraft,
    onCreateJsonTemplateDraft,
    onEditorInput,
    onImportFile,
    onLoadJsonTemplate,
  } = $props();

  const directVarsKey = TX_VARS.txWorkflowDirect;
  const workflowTemplateSelectStateStore = jsonTemplateSelectStateFor(
    TX_TEMPLATE_KIND.txWorkflow,
  );
  const txWorkflowInputWorkspace = createTxWorkflowInputPanelWorkspace();
  const {
    changeFormModel,
    createDirectDraft,
    editorDisplayStateStore,
    ensureInitialized,
    formErrorDetailStateStore,
    formErrorStateStore,
    formModelStateStore,
    handleWorkflowEditorInput,
    importFile,
    jsonTextStateStore,
    loadJsonTemplate,
    panelDisplayStateStore,
    setWorkflowInputPanelContext,
    syncStatusStateStore,
  } = txWorkflowInputWorkspace;
  let currentLanguage = $derived($currentLanguageState);
  let txWorkflowInputDisplay = $derived($panelDisplayStateStore);
  let txWorkflowEditorDisplay = $derived($editorDisplayStateStore);
  let txWorkflowFormModel = $derived($formModelStateStore);
  let txWorkflowFormError = $derived($formErrorStateStore);
  let txWorkflowFormErrorDetail = $derived($formErrorDetailStateStore);
  let txWorkflowJsonText = $derived($jsonTextStateStore);
  let txWorkflowSyncStatus = $derived($syncStatusStateStore);
  let workflowTemplateSelectState = $derived($workflowTemplateSelectStateStore);
  let workflowSourceSelection = $state(MANUAL_COMMAND_SOURCE);
  let workflowSourceLoading = $state(false);
  let workflowSourceOptions = $derived(
    Array.isArray(workflowTemplateSelectState?.names)
      ? workflowTemplateSelectState.names
      : [],
  );
  let txWorkflowSyncPresentation = $derived.by(() => {
    currentLanguage;
    return transactionEditorSyncPresentation(txWorkflowSyncStatus);
  });
  let txWorkflowReadonlyPreview = $derived.by(() => {
    currentLanguage;
    return txWorkflowPreviewPresentation(
      JSON.parse(txWorkflowFormModelToJsonText(txWorkflowFormModel)),
    );
  });
  let canvasViewDialog = $state({ open: false, mode: "json" });
  let canvasViewDialogTitle = $derived.by(() => {
    currentLanguage;
    return t(
      canvasViewDialog.mode === "readonly"
        ? "txWorkflowReadonlyDialogTitle"
        : "txWorkflowJsonDialogTitle",
    );
  });
  let canvasViewDialogHint = $derived.by(() => {
    currentLanguage;
    return t(
      canvasViewDialog.mode === "readonly"
        ? "txWorkflowReadonlyDialogHint"
        : "txWorkflowJsonDialogHint",
    );
  });

  function openCanvasViewDialog(mode) {
    if (mode !== "json" && mode !== "readonly") return;
    canvasViewDialog = { open: true, mode };
  }

  function setCanvasViewDialogOpen(open) {
    canvasViewDialog = { ...canvasViewDialog, open };
  }

  function resetWorkflowSourceSelection() {
    setJsonTemplateSelectValue(TX_TEMPLATE_KIND.txWorkflow, "");
    workflowSourceSelection = MANUAL_COMMAND_SOURCE;
  }

  async function createManualWorkflowDraft() {
    const result = await createDirectDraft();
    resetWorkflowSourceSelection();
    return result;
  }

  async function importManualWorkflow(file) {
    const result = await importFile(file);
    resetWorkflowSourceSelection();
    return result;
  }

  async function selectWorkflowSource(sourceValue) {
    const nextSource =
      String(sourceValue || "").trim() || MANUAL_COMMAND_SOURCE;
    if (nextSource === workflowSourceSelection) return true;
    workflowSourceLoading = true;
    try {
      if (nextSource === MANUAL_COMMAND_SOURCE) {
        await createManualWorkflowDraft();
        return true;
      }
      const loadedTemplate = await loadJsonTemplate(nextSource);
      if (!loadedTemplate) return false;
      workflowSourceSelection = nextSource;
      return true;
    } finally {
      workflowSourceLoading = false;
    }
  }

  $effect(() => {
    setWorkflowInputPanelContext({
      onCreateDirectDraft,
      onCreateJsonTemplateDraft,
      onEditorInput,
      onImportFile,
      onLoadJsonTemplate,
    });
    ensureInitialized();
  });
</script>

<div class="grid gap-4">
  <Card.Root class="gap-0 overflow-hidden py-0">
    <Card.Header class="border-b bg-muted/15 p-4 sm:p-5">
      <Card.Title>{txWorkflowEditorDisplay.editorTitle}</Card.Title>
      <Card.Description>{txWorkflowInputDisplay.directHint}</Card.Description>
      <Card.Action>
        <div class="inline-flex flex-wrap items-center justify-end gap-2">
          <LoadingButton
            variant="outline"
            size="sm"
            loading={jsonNewLoading}
            onclick={createManualWorkflowDraft}
          >
            <span>{txWorkflowInputDisplay.newButtonLabel}</span>
          </LoadingButton>
          <FilePickerButton
            variant="outline"
            size="sm"
            accept=".json,application/json"
            onFile={importManualWorkflow}
          >
            {txWorkflowInputDisplay.importButtonLabel}
          </FilePickerButton>
        </div>
      </Card.Action>
    </Card.Header>
    <Card.Content class="grid gap-5 p-4 sm:p-5">
      <CommandTemplateSourceField
        value={workflowSourceSelection}
        optionValues={workflowSourceOptions}
        disabled={workflowSourceLoading}
        labelText={t("txWorkflowSourceLabel")}
        hintText={t("txWorkflowSourceHint")}
        manualLabelText={t("txWorkflowSourceManual")}
        onValueChange={selectWorkflowSource}
      />
      <TxDirectVarsPanel
        {active}
        hidden-textarea={false}
        hintKey="txWorkflowVarsHint"
        placeholderFallback={txWorkflowVarsPlaceholder}
        placeholderKey="txWorkflowVarsPlaceholder"
        prefix="tx-workflow-direct"
        varsKey={directVarsKey}
      />
      <TxJsonFormSurface
        {active}
        editorDisplayMode="form"
        editorKey={txWorkflowEditorDisplay.editorKey}
        editorValue={txWorkflowJsonText}
        editorTitle={txWorkflowEditorDisplay.editorTitle}
        formError={txWorkflowFormError}
        formErrorDetail={txWorkflowFormErrorDetail}
        hostClass={txWorkflowEditorDisplay.hostClass}
        navigationMode="hidden"
        onEditorInput={handleWorkflowEditorInput}
        placeholder={txWorkflowEditorDisplay.placeholder}
        syncStatus={txWorkflowSyncStatus}
        syncStatusText={txWorkflowSyncPresentation.text}
        syncStatusTone={txWorkflowSyncPresentation.tone}
      >
        {#snippet formContent()}
          <TxWorkflowVisualEditor
            model={txWorkflowFormModel}
            onChange={changeFormModel}
            onOpenView={openCanvasViewDialog}
          />
        {/snippet}
        {#snippet readonlyContent()}
          <TxWorkflowPreviewPanel
            framed={false}
            previewPresentation={txWorkflowReadonlyPreview}
          />
        {/snippet}
      </TxJsonFormSurface>
    </Card.Content>
  </Card.Root>
</div>

<Dialog.Root
  open={canvasViewDialog.open}
  onOpenChange={setCanvasViewDialogOpen}
>
  <Dialog.Content
    class="flex h-[min(90dvh,52rem)] max-h-[90dvh] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden border-border bg-card p-0 shadow-2xl sm:max-w-6xl"
  >
    <Dialog.Header
      class="shrink-0 border-b border-border bg-muted/15 px-5 py-4 pr-14"
    >
      <div class="flex min-w-0 items-start gap-3 text-left">
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15"
        >
          {#if canvasViewDialog.mode === "readonly"}
            <EyeIcon class="size-5" />
          {:else}
            <BracesIcon class="size-5" />
          {/if}
        </span>
        <div class="min-w-0">
          <Dialog.Title>{canvasViewDialogTitle}</Dialog.Title>
          <Dialog.Description>{canvasViewDialogHint}</Dialog.Description>
        </div>
      </div>
    </Dialog.Header>
    <div
      class={canvasViewDialog.mode === "json"
        ? "min-h-0 flex-1 overflow-hidden p-4 sm:p-6"
        : "min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6"}
    >
      <TxJsonFormSurface
        active={active && canvasViewDialog.open}
        editorDisplayMode={canvasViewDialog.mode}
        editorKind="inline"
        editorKey={txWorkflowEditorDisplay.editorKey}
        editorValue={txWorkflowJsonText}
        editorTitle={canvasViewDialogTitle}
        formError={txWorkflowFormError}
        formErrorDetail={txWorkflowFormErrorDetail}
        hostClass={txWorkflowEditorDisplay.hostClass}
        fillEditorHeight
        immediateEditorInput
        navigationMode="hidden"
        onEditorInput={handleWorkflowEditorInput}
        onInlineEditorChange={handleWorkflowEditorInput}
        placeholder={txWorkflowEditorDisplay.placeholder}
        syncStatus={txWorkflowSyncStatus}
        syncStatusText={txWorkflowSyncPresentation.text}
        syncStatusTone={txWorkflowSyncPresentation.tone}
      >
        {#snippet readonlyContent()}
          <TxWorkflowPreviewPanel
            framed={false}
            previewPresentation={txWorkflowReadonlyPreview}
          />
        {/snippet}
      </TxJsonFormSurface>
    </div>
  </Dialog.Content>
</Dialog.Root>

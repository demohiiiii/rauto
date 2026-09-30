<script lang="ts">
  import BracesIcon from "@lucide/svelte/icons/braces";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import { get } from "svelte/store";
  import { onDestroy } from "svelte";
  import { browserConfirm } from "$lib/browser.js";
  import { createExecutionTemplateWorkspace } from "$domains/templates/index.js";
  import { txWorkflowEditorFormStateFromJsonText } from "$domains/transactions/index.js";
  import TemplateSourceActions from "$components/fragments/TemplateSourceActions.svelte";
  import TemplateSaveDialog from "$components/fragments/TemplateSaveDialog.svelte";
  import StatusCard from "$components/fragments/StatusCard.svelte";
  import FilePickerButton from "$components/fragments/FilePickerButton.svelte";
  import * as Card from "$lib/components/ui/card";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import TemplateSourceField from "$components/fragments/TemplateSourceField.svelte";
  import WorkspaceActionHeader from "$components/fragments/WorkspaceActionHeader.svelte";
  import { currentLanguageState, t } from "$lib/i18n.js";
  import { MANUAL_COMMAND_SOURCE } from "$domains/command/index.js";
  import {
    transactionEditorSyncPresentation,
    txWorkflowVarsPlaceholder,
  } from "$domains/transactions/index.js";
  import TxDirectVarsPanel from "$domains/transactions/presentation/components/shared/TxDirectVarsPanel.svelte";
  import TxJsonFormSurface from "$domains/transactions/presentation/components/shared/TxJsonFormSurface.svelte";
  import TxWorkflowPreviewPanel from "$domains/transactions/presentation/components/workflow/TxWorkflowPreviewPanel.svelte";
  import TxWorkflowVisualEditor from "$domains/transactions/presentation/components/workflow/TxWorkflowVisualEditor.svelte";
  import { createTxWorkflowInputPanelWorkspace } from "$domains/transactions/index.js";
  import { txWorkflowFormModelToJsonText } from "$domains/transactions/index.js";
  import { txWorkflowPreviewPresentation } from "$domains/transactions/index.js";
  import type { TxWorkflowFormModel } from "$domains/transactions/index.js";
  import Layers3Icon from "@lucide/svelte/icons/layers-3";

  import {
    TX_TEMPLATE_KIND,
    TX_VARS,
    setJsonTemplateSelectValue,
  } from "$domains/transactions/index.js";

  type CanvasViewMode = "json" | "readonly";

  interface Props {
    active?: boolean;
    onEditorInput?: (text: string) => void;
  }

  let { active, onEditorInput }: Props = $props();

  const directVarsKey = TX_VARS.txWorkflowDirect;
  const txWorkflowInputWorkspace = createTxWorkflowInputPanelWorkspace<File>();
  const {
    changeFormModel,
    editorDisplayStateStore,
    ensureInitialized,
    formErrorDetailStateStore,
    formErrorStateStore,
    formModelStateStore,
    handleWorkflowEditorInput,
    jsonTextStateStore,
    panelDisplayStateStore,
    resetDraft,
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
  const templateWorkspace = createExecutionTemplateWorkspace({
    apiBase: "/api/tx-workflow-templates",
    confirmReplace: () =>
      browserConfirm(t("orchestrationDiscardChangesConfirm")),
    createDraft: () => {
      resetDraft();
    },
    getCurrentJson: () => get(jsonTextStateStore),
    validateContent: (text) => {
      const parsed = txWorkflowEditorFormStateFromJsonText(text);
      if (parsed.formError) throw new Error(parsed.formError);
    },
    replaceJson: handleWorkflowEditorInput,
  });
  const { displayStateStore: templateDisplayStateStore } = templateWorkspace;
  let templateDisplay = $derived($templateDisplayStateStore);
  let workflowSourceSelection = $derived(
    templateDisplay.selectedName || MANUAL_COMMAND_SOURCE,
  );
  let templateInitialized = false;
  function changeCurrentFormModel(model: TxWorkflowFormModel): void {
    if (!templateWorkspace.canEdit()) return;
    changeFormModel(model);
    templateWorkspace.markEdited();
  }
  function changeCurrentJson(text: string): void {
    if (!templateWorkspace.canEdit()) return;
    handleWorkflowEditorInput(text);
    templateWorkspace.markEdited();
  }
  $effect(() => {
    setJsonTemplateSelectValue(
      TX_TEMPLATE_KIND.txWorkflow,
      templateDisplay.selectedName,
    );
  });
  $effect(() => {
    if (!active || templateInitialized) return;
    templateInitialized = true;
    void templateWorkspace.initialize();
  });
  onDestroy(templateWorkspace.destroy);
  let txWorkflowSyncPresentation = $derived.by(() => {
    currentLanguage;
    return transactionEditorSyncPresentation(txWorkflowSyncStatus);
  });
  let txWorkflowReadonlyPreview = $derived.by(() => {
    currentLanguage;
    const previewValue: unknown = JSON.parse(
      txWorkflowFormModelToJsonText(txWorkflowFormModel),
    );
    return txWorkflowPreviewPresentation(previewValue);
  });
  let canvasViewDialog = $state<{
    open: boolean;
    mode: CanvasViewMode;
  }>({ open: false, mode: "json" });
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

  function openCanvasViewDialog(mode: CanvasViewMode): void {
    if (mode !== "json" && mode !== "readonly") return;
    canvasViewDialog = { open: true, mode };
  }

  function setCanvasViewDialogOpen(open: boolean): void {
    canvasViewDialog = { ...canvasViewDialog, open };
  }

  async function importManualWorkflow(file: File | null): Promise<void> {
    if (file) await templateWorkspace.importContent(() => file.text());
  }

  function selectWorkflowSource(value: string): Promise<boolean> {
    return templateWorkspace.selectTemplate(
      value === MANUAL_COMMAND_SOURCE ? "" : value,
    );
  }

  $effect(() => {
    setWorkflowInputPanelContext({ onEditorInput });
    ensureInitialized();
  });
</script>

<div class="grid gap-4">
  <Card.Root class="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
    <WorkspaceActionHeader
      title={txWorkflowEditorDisplay.editorTitle}
      description={txWorkflowInputDisplay.directHint}
      icon={Layers3Icon}
    >
      {#snippet actions()}
        {#if !templateDisplay.selectedName}
          <FilePickerButton
            accept=".json,application/json"
            disabled={!!templateDisplay.loadingAction}
            onFile={importManualWorkflow}
            >{t("orchestrationImportFileBtn")}</FilePickerButton
          >
        {/if}
      {/snippet}
    </WorkspaceActionHeader>
    <Card.Content class="grid gap-5 p-4 sm:p-5">
      <TemplateSourceField
        manualValue={MANUAL_COMMAND_SOURCE}
        value={workflowSourceSelection}
        optionValues={templateDisplay.templateNames}
        disabled={!!templateDisplay.loadingAction}
        hintText={t("txWorkflowSourceHint")}
        onValueChange={selectWorkflowSource}
      >
        {#snippet actions()}
          <TemplateSourceActions
            readonly={templateDisplay.readonly}
            editing={templateDisplay.editing}
            busy={!!templateDisplay.loadingAction}
            saving={templateDisplay.loadingAction.startsWith("save")}
            canSave={!txWorkflowFormError}
            onEdit={templateWorkspace.startEditing}
            onCopy={templateWorkspace.copyToManual}
            onSave={templateWorkspace.saveTemplate}
            onCancel={templateWorkspace.cancelEditing}
          />
        {/snippet}
      </TemplateSourceField>
      {#if templateDisplay.errorMessage}<StatusCard
          message={templateDisplay.errorMessage}
          tone="error"
        />{/if}
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
        readonly={templateDisplay.readonly || !!templateDisplay.loadingAction}
        {active}
        editorDisplayMode="form"
        editorKey={txWorkflowEditorDisplay.editorKey}
        editorValue={txWorkflowJsonText}
        editorTitle={txWorkflowEditorDisplay.editorTitle}
        formError={txWorkflowFormError}
        formErrorDetail={txWorkflowFormErrorDetail}
        hostClass={txWorkflowEditorDisplay.hostClass}
        navigationMode="hidden"
        onEditorInput={changeCurrentJson}
        placeholder={txWorkflowEditorDisplay.placeholder}
        syncStatus={txWorkflowSyncStatus}
        syncStatusText={txWorkflowSyncPresentation.text}
        syncStatusTone={txWorkflowSyncPresentation.tone}
      >
        {#snippet formContent()}
          <TxWorkflowVisualEditor
            readonly={templateDisplay.readonly ||
              !!templateDisplay.loadingAction}
            model={txWorkflowFormModel}
            onChange={changeCurrentFormModel}
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
        readonly={templateDisplay.readonly || !!templateDisplay.loadingAction}
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
        onEditorInput={changeCurrentJson}
        onInlineEditorChange={changeCurrentJson}
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

<TemplateSaveDialog
  open={templateDisplay.nameDialog.open}
  value={templateDisplay.nameDialog.value}
  error={templateDisplay.nameDialog.error || templateDisplay.errorMessage}
  busy={!!templateDisplay.loadingAction}
  onChange={templateWorkspace.changeNameDialogValue}
  onClose={templateWorkspace.closeNameDialog}
  onSave={templateWorkspace.submitNameDialog}
/>

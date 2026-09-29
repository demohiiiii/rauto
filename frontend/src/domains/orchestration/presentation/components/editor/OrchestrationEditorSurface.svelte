<script lang="ts">
  import BracesIcon from "@lucide/svelte/icons/braces";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import TemplateSourceActions from "$components/fragments/TemplateSourceActions.svelte";
  import TemplateSaveDialog from "$components/fragments/TemplateSaveDialog.svelte";
  import FilePickerButton from "$components/fragments/FilePickerButton.svelte";
  import TemplateSourceField from "$components/fragments/TemplateSourceField.svelte";
  import StatusCard from "$components/fragments/StatusCard.svelte";
  import WorkspaceActionHeader from "$components/fragments/WorkspaceActionHeader.svelte";
  import NetworkIcon from "@lucide/svelte/icons/network";
  import { currentLanguageState, t } from "$lib/i18n.js";
  import { orchestrationPlanFormModelToJsonText } from "$domains/orchestration/index.js";
  import { TX_EDITOR } from "$domains/transactions/index.js";
  import ExecutionRunBar from "$components/fragments/ExecutionRunBar.svelte";
  import OrchestrationPlanFormEditor from "$domains/orchestration/presentation/components/editor/OrchestrationPlanFormEditor.svelte";
  import OrchestrationPreviewPanel from "$domains/orchestration/presentation/components/preview/OrchestrationPreviewPanel.svelte";
  import TxJsonFormSurface from "$domains/transactions/presentation/components/shared/TxJsonFormSurface.svelte";

  import type {
    OrchestrationEditorRunPanelDisplay,
    OrchestrationEditorTextFile,
    OrchestrationEditorView,
    OrchestrationPlan,
    OrchestrationPlanChangeHandler,
    OrchestrationPlanFormModel,
    OrchestrationRunButtonDisplay,
    OrchestrationVisualEditorDisplay,
  } from "$domains/orchestration/index.js";

  import type { ExecutionTemplateDisplayState } from "$domains/templates/index.js";

  type TemplateAction = () => Promise<boolean> | boolean | void;

  interface Props {
    active?: boolean;
    changeNameDialogValue: (value: string) => void;
    closeNameDialog: () => void;
    editorDisplay: OrchestrationEditorRunPanelDisplay;
    editorValue: string;
    onEditorErrorChange?: (error: string) => void;
    onEditorInput?: (text: string) => void;
    onExecute?: () => Promise<void> | void;
    onFormChange?: OrchestrationPlanChangeHandler;
    onImportFile?: (
      file: OrchestrationEditorTextFile,
    ) => Promise<boolean | void> | boolean | void;
    onTemplateChange: (templateName: string) => Promise<boolean> | boolean;
    startEditing: () => void;
    copyToManual: () => void;
    cancelEditing: TemplateAction;
    orchestrationFormError: string;
    orchestrationFormModel: OrchestrationPlanFormModel;
    runButtonDisplay?: OrchestrationRunButtonDisplay;
    saveTemplate: TemplateAction;
    submitNameDialog: TemplateAction;
    templateDisplay: ExecutionTemplateDisplayState;
    visualDisplay: OrchestrationVisualEditorDisplay;
  }

  let {
    active,
    editorDisplay,
    editorValue,
    orchestrationFormError,
    orchestrationFormModel,
    visualDisplay,
    onFormChange,
    onEditorErrorChange,
    onEditorInput,
    onExecute,
    onImportFile,
    templateDisplay,
    onTemplateChange,
    startEditing,
    copyToManual,
    cancelEditing,
    saveTemplate,
    changeNameDialogValue,
    closeNameDialog,
    submitNameDialog,
    runButtonDisplay = {},
  }: Props = $props();

  let currentLanguage = $derived($currentLanguageState);
  let editorDialog = $state<{
    mode: OrchestrationEditorView;
    open: boolean;
  }>({ open: false, mode: "json" });
  let templateBusy = $derived(!!templateDisplay?.loadingAction);
  let nameDialog = $derived(templateDisplay.nameDialog);
  let templateStatusMessage = $derived.by(() => {
    currentLanguage;
    const statusKind = templateDisplay?.statusKind;
    if (!statusKind) return "";
    const label = t(`orchestrationTemplateStatus_${statusKind}`);
    return templateDisplay?.statusName
      ? `${label}: ${templateDisplay.statusName}`
      : label;
  });
  let readonlyPlan = $derived.by<OrchestrationPlan | null>(() => {
    try {
      return JSON.parse(
        orchestrationPlanFormModelToJsonText(orchestrationFormModel),
      ) as OrchestrationPlan;
    } catch {
      return null;
    }
  });
  let editorDialogTitle = $derived.by(() => {
    currentLanguage;
    return t(
      editorDialog.mode === "readonly"
        ? "orchestrationReadonlyDialogTitle"
        : "orchestrationJsonDialogTitle",
    );
  });
  let editorDialogHint = $derived.by(() => {
    currentLanguage;
    return t(
      editorDialog.mode === "readonly"
        ? "orchestrationReadonlyDialogHint"
        : "orchestrationJsonDialogHint",
    );
  });
  function openEditorDialog(mode: OrchestrationEditorView): void {
    if (mode !== "json" && mode !== "readonly") return;
    editorDialog = { open: true, mode };
  }

  function setEditorDialogOpen(open: boolean): void {
    editorDialog = { ...editorDialog, open };
  }

  async function executeCurrentPlan(): Promise<void> {
    await onExecute?.();
  }
</script>

<Card.Root class="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
  <WorkspaceActionHeader
    title={t("orchestrationWorkspaceTitle")}
    description={t("orchestrationWorkspaceHint")}
    icon={NetworkIcon}
  >
    {#snippet actions()}
      {#if !templateDisplay.selectedName}
        <FilePickerButton
          accept=".json,application/json"
          disabled={templateBusy}
          onFile={async (file) => {
            if (file) await onImportFile?.(file);
          }}>{t("orchestrationImportFileBtn")}</FilePickerButton
        >
      {/if}
    {/snippet}
  </WorkspaceActionHeader>

  <Card.Content class="grid gap-4 p-4 sm:p-5">
    <div class="grid min-w-0 gap-2">
      <TemplateSourceField
        value={templateDisplay.selectedName || ""}
        optionValues={templateDisplay.templateNames}
        disabled={templateBusy}
        onValueChange={onTemplateChange}
      >
        {#snippet actions()}
          <TemplateSourceActions
            readonly={templateDisplay.readonly}
            editing={templateDisplay.editing}
            busy={templateBusy}
            saving={templateDisplay.loadingAction.startsWith("save")}
            canSave={!orchestrationFormError}
            onEdit={startEditing}
            onCopy={copyToManual}
            onSave={saveTemplate}
            onCancel={cancelEditing}
          />
        {/snippet}
      </TemplateSourceField>
      <div class="min-w-0">
        {#if templateDisplay?.errorMessage}
          <StatusCard message={templateDisplay.errorMessage} tone="error" />
        {:else if templateStatusMessage}
          <StatusCard message={templateStatusMessage} tone="success" />
        {/if}
      </div>
    </div>

    <OrchestrationPlanFormEditor
      readonly={templateDisplay.readonly || templateBusy}
      {active}
      model={orchestrationFormModel}
      {visualDisplay}
      onChange={onFormChange}
      onErrorChange={onEditorErrorChange}
      onOpenView={openEditorDialog}
    />
  </Card.Content>
</Card.Root>

<TemplateSaveDialog
  open={nameDialog.open}
  value={nameDialog.value}
  error={nameDialog.error || templateDisplay.errorMessage}
  busy={templateBusy}
  onChange={changeNameDialogValue}
  onClose={closeNameDialog}
  onSave={submitNameDialog}
/>

<Dialog.Root open={editorDialog.open} onOpenChange={setEditorDialogOpen}>
  <Dialog.Content
    class="flex h-[min(90dvh,54rem)] max-h-[90dvh] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden border-border bg-card p-0 shadow-2xl sm:max-w-6xl"
  >
    <Dialog.Header
      class="shrink-0 border-b border-border bg-muted/15 px-5 py-4 pr-14"
    >
      <div class="flex min-w-0 items-start gap-3 text-left">
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15"
        >
          {#if editorDialog.mode === "readonly"}
            <EyeIcon />
          {:else}
            <BracesIcon />
          {/if}
        </span>
        <div class="min-w-0">
          <Dialog.Title>{editorDialogTitle}</Dialog.Title>
          <Dialog.Description>{editorDialogHint}</Dialog.Description>
        </div>
      </div>
    </Dialog.Header>
    <div
      class={editorDialog.mode === "json"
        ? "min-h-0 flex-1 overflow-hidden p-4 sm:p-6"
        : "min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6"}
    >
      <TxJsonFormSurface
        readonly={templateDisplay.readonly || templateBusy}
        active={active && editorDialog.open}
        editorDisplayMode={editorDialog.mode}
        editorKind="inline"
        editorKey={TX_EDITOR.orchestration}
        {editorValue}
        editorTitle={editorDialogTitle}
        formError={orchestrationFormError}
        hostClass="tx-json-editor tx-json-editor-compact"
        fillEditorHeight={editorDialog.mode === "json"}
        immediateEditorInput
        navigationMode="hidden"
        onInlineEditorChange={onEditorInput}
        placeholder={editorDisplay.placeholderText}
      >
        {#snippet readonlyContent()}
          <OrchestrationPreviewPanel
            message=""
            plan={readonlyPlan}
            previewMode="preview"
            text=""
            tone="info"
          />
        {/snippet}
      </TxJsonFormSurface>
    </div>
  </Dialog.Content>
</Dialog.Root>

<ExecutionRunBar
  {active}
  buttonLabel={t("orchestrationExecBtn")}
  loading={runButtonDisplay.executeLoading}
  showAutoDownloadOutput={false}
  onRun={executeCurrentPlan}
/>

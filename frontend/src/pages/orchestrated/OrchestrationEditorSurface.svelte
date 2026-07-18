<script>
  import BracesIcon from "@lucide/svelte/icons/braces";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import PlayIcon from "@lucide/svelte/icons/play";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import PlainSelectField from "../../components/fragments/PlainSelectField.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import WorkspaceActionHeader from "../../components/fragments/WorkspaceActionHeader.svelte";
  import WorkspaceTemplateActions from "../../components/fragments/WorkspaceTemplateActions.svelte";
  import { currentLanguageState, t } from "../../lib/i18n.js";
  import { orchestrationPlanFormModelToJsonText } from "../../modules/orchestrationFormState.js";
  import { TX_EDITOR } from "../../modules/transactionPanelState.js";
  import OrchestrationExecutionPanel from "./OrchestrationExecutionPanel.svelte";
  import OrchestrationPlanFormEditor from "./OrchestrationPlanFormEditor.svelte";
  import OrchestrationPreviewPanel from "./OrchestrationPreviewPanel.svelte";
  import TxJsonFormSurface from "./TxJsonFormSurface.svelte";

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
    openNewDialog,
    saveTemplate,
    openSaveAsDialog,
    changeNameDialogValue,
    closeNameDialog,
    submitNameDialog,
    runButtonDisplay = {},
    executionPanelDisplay = {},
  } = $props();

  let currentLanguage = $derived($currentLanguageState);
  let editorDialog = $state({ open: false, mode: "json" });
  let executionDialogOpen = $state(false);
  let templateBusy = $derived(!!templateDisplay?.loadingAction);
  let nameDialog = $derived(
    templateDisplay?.nameDialog || {
      error: "",
      mode: "new",
      open: false,
      value: "",
    },
  );
  let templateOptions = $derived.by(() => {
    currentLanguage;
    return [
      {
        optionLabel: t("orchestrationTemplateManualDraft"),
        optionValue: "",
      },
      ...(Array.isArray(templateDisplay?.templateOptions)
        ? templateDisplay.templateOptions
            .filter((option) => option.value)
            .map((option) => ({
              optionLabel: option.label || option.value,
              optionValue: option.value,
            }))
        : []),
    ];
  });
  let selectionLabel = $derived.by(() => {
    currentLanguage;
    if (templateDisplay?.selectionKind === "new") {
      return t("orchestrationTemplateUnsavedDraft");
    }
    if (templateDisplay?.selectionKind === "existing") {
      return t("orchestrationTemplateSavedTemplate");
    }
    return t("orchestrationTemplateManualDraft");
  });
  let templateStatusMessage = $derived.by(() => {
    currentLanguage;
    const statusKind = templateDisplay?.statusKind;
    if (!statusKind) return "";
    const label = t(`orchestrationTemplateStatus_${statusKind}`);
    return templateDisplay?.statusName
      ? `${label}: ${templateDisplay.statusName}`
      : label;
  });
  let readonlyPlan = $derived.by(() => {
    try {
      return JSON.parse(
        orchestrationPlanFormModelToJsonText(orchestrationFormModel),
      );
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
  let nameDialogTitle = $derived.by(() => {
    currentLanguage;
    return t(
      nameDialog.mode === "new"
        ? "orchestrationTemplateNewDialogTitle"
        : "orchestrationTemplateSaveAsDialogTitle",
    );
  });

  function openEditorDialog(mode) {
    if (mode !== "json" && mode !== "readonly") return;
    editorDialog = { open: true, mode };
  }

  function setEditorDialogOpen(open) {
    editorDialog = { ...editorDialog, open };
  }

  function handleNameDialogOpenChange(open) {
    if (!open) closeNameDialog();
  }

  function handleNameDialogKeydown(event) {
    if (event.key !== "Enter" || event.isComposing) return;
    event.preventDefault();
    void submitNameDialog();
  }

  async function executeCurrentPlan() {
    executionDialogOpen = true;
    return typeof onExecute === "function" ? onExecute() : undefined;
  }
</script>

<Card.Root class="overflow-hidden border-border shadow-sm">
  <WorkspaceActionHeader
    title={t("orchestrationWorkspaceTitle")}
    description={t("orchestrationWorkspaceHint")}
  >
    {#snippet status()}
      <Badge variant="secondary">{selectionLabel}</Badge>
      {#if templateDisplay?.selectedName}
        <Badge variant="outline">{templateDisplay.selectedName}</Badge>
      {/if}
      {#if templateDisplay?.dirty}
        <Badge variant="destructive">{t("orchestrationTemplateDirty")}</Badge>
      {/if}
    {/snippet}
    {#snippet actions()}
      <WorkspaceTemplateActions
        busy={templateBusy}
        canSave={!!templateDisplay?.selectedName}
        loadingAction={templateDisplay?.loadingAction}
        onNew={openNewDialog}
        onSave={saveTemplate}
        onSaveAs={openSaveAsDialog}
        onImport={onImportFile}
      />
    {/snippet}
  </WorkspaceActionHeader>

  <Card.Content class="grid gap-4 p-4 sm:p-5">
    <div class="grid gap-2 sm:grid-cols-[minmax(0,22rem)_1fr] sm:items-end">
      <label class="grid gap-2">
        <span class="text-sm font-medium text-foreground">
          {t("orchestrationTemplateSelectLabel")}
        </span>
        <PlainSelectField
          value={templateDisplay?.selectedName || ""}
          optionRows={templateOptions}
          disabled={templateBusy}
          aria-label={t("orchestrationTemplateSelectLabel")}
          onValueChange={onTemplateChange}
        />
      </label>
      <div class="min-w-0">
        {#if templateDisplay?.errorMessage}
          <StatusCard message={templateDisplay.errorMessage} tone="error" />
        {:else if templateStatusMessage}
          <StatusCard message={templateStatusMessage} tone="success" />
        {/if}
      </div>
    </div>

    <OrchestrationPlanFormEditor
      {active}
      model={orchestrationFormModel}
      {visualDisplay}
      onChange={onFormChange}
      onErrorChange={onEditorErrorChange}
      onOpenView={openEditorDialog}
      onExecute={executeCurrentPlan}
      {runButtonDisplay}
    />
  </Card.Content>
</Card.Root>

<Dialog.Root open={nameDialog.open} onOpenChange={handleNameDialogOpenChange}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>{nameDialogTitle}</Dialog.Title>
      <Dialog.Description>
        {t("orchestrationTemplateNameDialogHint")}
      </Dialog.Description>
    </Dialog.Header>
    <PlainInputField
      value={nameDialog.value}
      placeholderText={t("orchestrationTemplateNamePlaceholder")}
      aria-label={nameDialogTitle}
      aria-invalid={!!nameDialog.error}
      focus-request-version={nameDialog.open ? 1 : 0}
      select-on-focus-request={true}
      onValueInput={changeNameDialogValue}
      onKeydown={handleNameDialogKeydown}
    />
    {#if nameDialog.error}
      <p class="text-sm text-destructive" role="alert">
        {nameDialog.error === "name_required"
          ? t("orchestrationTemplateNameRequired")
          : nameDialog.error}
      </p>
    {/if}
    <Dialog.Footer>
      <Button variant="outline" onclick={closeNameDialog}>
        {t("cancelBtn")}
      </Button>
      <LoadingButton
        loading={templateDisplay?.loadingAction === "new" ||
          templateDisplay?.loadingAction === "save_as"}
        disabled={templateBusy}
        onclick={submitNameDialog}
      >
        {t("confirmBtn")}
      </LoadingButton>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

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

<Dialog.Root bind:open={executionDialogOpen}>
  <Dialog.Content
    class="flex max-h-[90dvh] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden border-border bg-card p-0 shadow-2xl sm:max-w-6xl"
  >
    <Dialog.Header
      class="shrink-0 border-b border-border bg-muted/15 px-5 py-4 pr-14"
    >
      <div class="flex min-w-0 items-start gap-3 text-left">
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15"
          ><PlayIcon /></span
        >
        <div class="min-w-0">
          <Dialog.Title>{t("orchestrationExecutionDialogTitle")}</Dialog.Title>
          <Dialog.Description
            >{t("orchestrationExecutionDialogHint")}</Dialog.Description
          >
        </div>
      </div>
    </Dialog.Header>
    <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
      <OrchestrationExecutionPanel panelDisplay={executionPanelDisplay} />
    </div>
  </Dialog.Content>
</Dialog.Root>

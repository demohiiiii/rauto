<script>
  import * as Card from "$lib/components/ui/card";
  import FilePickerButton from "../../components/fragments/FilePickerButton.svelte";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import TabList from "../../components/fragments/TabList.svelte";
  import TxDirectVarsPanel from "./TxDirectVarsPanel.svelte";
  import TxJsonFormSurface from "./TxJsonFormSurface.svelte";
  import TxTemplateRunPanel from "./TxTemplateRunPanel.svelte";
  import TxWorkflowVisualEditor from "./TxWorkflowVisualEditor.svelte";
  import {
    createTxWorkflowInputPanelWorkspace,
    txWorkflowTemplateVarsPlaceholder,
    txWorkflowVarsPlaceholder,
  } from "../../modules/transactionInputWorkspaces.js";

  import {
    TX_TEMPLATE_KIND,
    TX_VARS,
  } from "../../modules/transactionPanelState.js";

  let {
    active,
    activeMode,
    jsonNewLoading,
    modeTabs,
    onCreateDirectDraft,
    onCreateJsonTemplateDraft,
    onDeleteJsonTemplate,
    onEditorInput,
    onImportFile,
    onLoadJsonTemplate,
    onSaveJsonTemplate,
    onSelectMode,
  } = $props();

  const directVarsKey = TX_VARS.txWorkflowDirect;
  const templateVarsKey = TX_VARS.txWorkflowTemplate;
  const txWorkflowInputWorkspace = createTxWorkflowInputPanelWorkspace();
  const {
    changeFormModel,
    createDirectDraft,
    createTemplateDraft,
    editorDisplayStateStore,
    editorDisplayModeStateStore,
    ensureInitialized,
    formErrorStateStore,
    formModelStateStore,
    handleWorkflowEditorInput,
    importFile,
    jsonTextStateStore,
    loadJsonTemplate,
    panelDisplayStateStore,
    setWorkflowInputPanelContext,
    selectEditorView,
  } = txWorkflowInputWorkspace;
  let txWorkflowInputDisplay = $derived($panelDisplayStateStore);
  let txWorkflowEditorDisplay = $derived($editorDisplayStateStore);
  let editorDisplayMode = $derived($editorDisplayModeStateStore);
  let txWorkflowFormModel = $derived($formModelStateStore);
  let txWorkflowFormError = $derived($formErrorStateStore);
  let txWorkflowJsonText = $derived($jsonTextStateStore);
  let directPanelActive = $derived(
    active && txWorkflowInputDisplay.mode.isDirect,
  );
  let templatePanelActive = $derived(
    active && txWorkflowInputDisplay.mode.isTemplate,
  );

  $effect(() => {
    setWorkflowInputPanelContext({
      activeMode,
      onCreateDirectDraft,
      onCreateJsonTemplateDraft,
      onEditorInput,
      onImportFile,
      onLoadJsonTemplate,
    });
    ensureInitialized();
  });
</script>

<div class="grid gap-2">
  <TabList
    tabItems={modeTabs}
    activeValue={activeMode}
    aria-label={txWorkflowInputDisplay.tabAriaLabel}
    onSelect={onSelectMode}
  />
  {#if txWorkflowInputDisplay.mode.isDirect}
    <Card.Root>
      <Card.Header>
        <Card.Title>{txWorkflowEditorDisplay.editorTitle}</Card.Title>
      </Card.Header>
      <Card.Content class="grid gap-2">
        <div class="text-xs text-slate-500">
          {txWorkflowInputDisplay.directHint}
        </div>
        <div class="inline-flex flex-wrap items-center gap-2">
          <LoadingButton
            variant="outline"
            size="sm"
            loading={jsonNewLoading}
            onclick={createDirectDraft}
          >
            <span>{txWorkflowInputDisplay.newButtonLabel}</span>
          </LoadingButton>
          <FilePickerButton
            variant="outline"
            size="sm"
            accept=".json,application/json"
            onFile={importFile}
          >
            {txWorkflowInputDisplay.importButtonLabel}
          </FilePickerButton>
        </div>
        <TxDirectVarsPanel
          active={directPanelActive}
          hidden-textarea={false}
          hintKey="txWorkflowVarsHint"
          placeholderFallback={txWorkflowVarsPlaceholder}
          placeholderKey="txWorkflowVarsPlaceholder"
          prefix="tx-workflow-direct"
          varsKey={directVarsKey}
        />
        <TxJsonFormSurface
          active={directPanelActive}
          {editorDisplayMode}
          editorKey={txWorkflowEditorDisplay.editorKey}
          editorValue={txWorkflowJsonText}
          editorTitle={txWorkflowEditorDisplay.editorTitle}
          formError={txWorkflowFormError}
          hostClass={txWorkflowEditorDisplay.hostClass}
          onEditorInput={handleWorkflowEditorInput}
          onEditorViewSelect={selectEditorView}
          placeholder={txWorkflowEditorDisplay.placeholder}
        >
          {#snippet formContent()}
            <TxWorkflowVisualEditor
              model={txWorkflowFormModel}
              onChange={changeFormModel}
            />
          {/snippet}
        </TxJsonFormSurface>
      </Card.Content>
    </Card.Root>
  {:else if txWorkflowInputDisplay.mode.isTemplate}
    <Card.Root>
      <Card.Header>
        <Card.Title>{txWorkflowInputDisplay.tabAriaLabel}</Card.Title>
      </Card.Header>
      <Card.Content class="grid gap-2">
        <TxTemplateRunPanel
          active={templatePanelActive}
          hidden-textarea={false}
          hintKeys={["txWorkflowTemplateRunHint"]}
          onCreateTemplateDraft={createTemplateDraft}
          onDeleteTemplate={onDeleteJsonTemplate}
          onLoadTemplate={loadJsonTemplate}
          onSaveTemplate={onSaveJsonTemplate}
          templateKind={TX_TEMPLATE_KIND.txWorkflow}
          varsKey={templateVarsKey}
          varsPlaceholderFallback={txWorkflowTemplateVarsPlaceholder}
          varsPlaceholderKey="txWorkflowVarsPlaceholder"
          varsPrefix="tx-workflow-template"
        />
      </Card.Content>
    </Card.Root>
  {/if}
</div>

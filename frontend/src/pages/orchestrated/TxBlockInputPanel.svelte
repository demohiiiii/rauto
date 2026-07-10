<script>
  import * as Card from "$lib/components/ui/card";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import TabList from "../../components/fragments/TabList.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { txTemplateModeTabs } from "../../config/dashboardModes.js";
  import TxDirectVarsPanel from "./TxDirectVarsPanel.svelte";
  import TxJsonFormSurface from "./TxJsonFormSurface.svelte";
  import TxBlockVisualEditor from "./TxBlockVisualEditor.svelte";
  import TxTemplateRunPanel from "./TxTemplateRunPanel.svelte";
  import {
    createTxBlockInputPanelWorkspace,
    txBlockTemplateVarsPlaceholder,
    txBlockVarsPlaceholder,
  } from "../../modules/transactionInputWorkspaces.js";

  import {
    TX_TEMPLATE_KIND,
    TX_VARS,
  } from "../../modules/transactionsWorkspace.js";

  let {
    active,
    onCreateJsonTemplateDraft,
    onDeleteJsonTemplate,
    onDirectMode,
    onEditorInput,
    onLoadJsonTemplate,
    newButtonLabelKey,
    onSaveJsonTemplate,
    onTemplateMode,
  } = $props();

  const directVarsKey = TX_VARS.txBlockDirect;
  const templateVarsKey = TX_VARS.txBlockTemplate;
  const txBlockInputWorkspace = createTxBlockInputPanelWorkspace();
  const {
    changeFormModel,
    createFullDraft,
    createJsonDraft,
    createTemplateDraft,
    editorDisplayStateStore,
    editorDisplayModeStateStore,
    ensureInitialized,
    formErrorStateStore,
    formModelStateStore,
    handleEditorJsonInput,
    jsonTextStateStore,
    loadJsonTemplate,
    loadingKeysStore,
    panelDisplayStateStore,
    setBlockInputPanelContext,
    selectMode,
    selectEditorView,
  } = txBlockInputWorkspace;
  let txBlockInputDisplay = $derived($panelDisplayStateStore);
  let txBlockEditorDisplay = $derived($editorDisplayStateStore);
  let editorDisplayMode = $derived($editorDisplayModeStateStore);
  let txBlockFormModel = $derived($formModelStateStore);
  let txBlockFormError = $derived($formErrorStateStore);
  let txBlockJsonText = $derived($jsonTextStateStore);
  let directPanelActive = $derived(active && txBlockInputDisplay.mode.isDirect);
  let templatePanelActive = $derived(
    active && txBlockInputDisplay.mode.isTemplate,
  );
  let jsonNewLoading = $derived($loadingKeysStore.includes("json-new"));

  $effect(() => {
    setBlockInputPanelContext({
      newButtonLabelKey,
      onCreateJsonTemplateDraft,
      onDirectMode,
      onEditorInput,
      onLoadJsonTemplate,
      onTemplateMode,
    });
    ensureInitialized();
  });
</script>

<div class="grid gap-2">
  <div class="grid gap-2">
    <TabList
      tabItems={txTemplateModeTabs}
      activeValue={txBlockInputDisplay.activeMode}
      aria-label={txBlockInputDisplay.tabAriaLabel}
      onSelect={selectMode}
    />
    {#if txBlockInputDisplay.mode.isDirect}
      <Card.Root>
        <Card.Header>
          <Card.Title>{txBlockInputDisplay.tabAriaLabel}</Card.Title>
        </Card.Header>
        <Card.Content class="grid gap-2">
          <div class="text-xs text-slate-500">
            {txBlockInputDisplay.directHint}
          </div>
          <TxDirectVarsPanel
            active={directPanelActive}
            hidden-textarea={false}
            hintKey="txBlockDirectVarsHint"
            placeholderFallback={txBlockVarsPlaceholder}
            placeholderKey="txBlockDirectVarsPlaceholder"
            prefix="tx-block-direct"
            varsKey={directVarsKey}
          />
        </Card.Content>
      </Card.Root>
    {:else if txBlockInputDisplay.mode.isTemplate}
      <Card.Root>
        <Card.Header>
          <Card.Title>{txBlockInputDisplay.tabAriaLabel}</Card.Title>
        </Card.Header>
        <Card.Content class="grid gap-2">
          <TxTemplateRunPanel
            active={templatePanelActive}
            hidden-textarea={false}
            hintKeys={["txBlockTemplateRunHint"]}
            onCreateTemplateDraft={createTemplateDraft}
            onDeleteTemplate={onDeleteJsonTemplate}
            onLoadTemplate={loadJsonTemplate}
            onSaveTemplate={onSaveJsonTemplate}
            templateKind={TX_TEMPLATE_KIND.txBlock}
            varsKey={templateVarsKey}
            varsPlaceholderFallback={txBlockTemplateVarsPlaceholder}
            varsPlaceholderKey="txBlockTemplateVarsPlaceholder"
            varsPrefix="tx-block-template"
          />
        </Card.Content>
      </Card.Root>
    {/if}
  </div>
  <Card.Root>
    <Card.Header>
      <Card.Title>{txBlockInputDisplay.editorTitle}</Card.Title>
      <Card.Action>
        <div class="inline-flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onclick={createFullDraft}
          >
            <span>{txBlockInputDisplay.fullDraftButtonLabel}</span>
          </Button>
          <LoadingButton
            size="sm"
            loading={jsonNewLoading}
            onclick={createJsonDraft}
          >
            <span>{txBlockInputDisplay.newButtonLabel}</span>
          </LoadingButton>
        </div>
      </Card.Action>
    </Card.Header>
    <Card.Content class="grid gap-2">
      <div class="text-xs text-slate-500">
        {txBlockInputDisplay.jsonHint}
      </div>
      <TxJsonFormSurface
        {active}
        {editorDisplayMode}
        editorKey={txBlockEditorDisplay.editorKey}
        editorValue={txBlockJsonText}
        editorTitle={txBlockEditorDisplay.editorTitle}
        formError={txBlockFormError}
        hostClass={txBlockEditorDisplay.hostClass}
        jsonHintText={txBlockEditorDisplay.jsonHintText}
        onEditorInput={handleEditorJsonInput}
        onEditorViewSelect={selectEditorView}
        placeholder={txBlockEditorDisplay.placeholder}
      >
        {#snippet formContent()}
          <TxBlockVisualEditor
            model={txBlockFormModel}
            onChange={changeFormModel}
          />
        {/snippet}
      </TxJsonFormSurface>
    </Card.Content>
  </Card.Root>
</div>

<script>
  import * as Card from "$lib/components/ui/card";
  import TabList from "../../components/fragments/TabList.svelte";
  import { txTemplateModeTabs } from "../../config/dashboardModes.js";
  import TxDirectVarsPanel from "./TxDirectVarsPanel.svelte";
  import OrchestrationEditorRunPanel from "./OrchestrationEditorRunPanel.svelte";
  import TxTemplateRunPanel from "./TxTemplateRunPanel.svelte";
  import {
    createOrchestrationInputPanelWorkspace,
    orchestrationTemplateVarsPlaceholder,
    orchestrationVarsPlaceholder,
  } from "../../modules/orchestrationWorkspace.js";

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
    onExecute,
    onImportFile,
    onLoadJsonTemplate,
    onPreview,
    onSaveJsonTemplate,
    onTemplateMode,
  } = $props();

  const directVarsKey = TX_VARS.orchestrationDirect;
  const templateVarsKey = TX_VARS.orchestrationTemplate;
  const orchestrationInputWorkspace = createOrchestrationInputPanelWorkspace();
  const {
    createJsonDraft,
    createTemplateDraft,
    editorSyncVersionStateStore,
    executeOrchestration,
    importFile,
    inputDisplayStateStore,
    loadJsonTemplate,
    orchestrationEditorRunButtonDisplayStateStore,
    previewOrchestration,
    setInputPanelContext,
    selectMode,
  } = orchestrationInputWorkspace;
  let orchestrationInputDisplay = $derived($inputDisplayStateStore);
  let directPanelActive = $derived(
    active && orchestrationInputDisplay.mode.isDirect,
  );
  let templatePanelActive = $derived(
    active && orchestrationInputDisplay.mode.isTemplate,
  );
  let orchestrationEditorSyncVersion = $derived($editorSyncVersionStateStore);
  let orchestrationEditorRunButtonDisplay = $derived(
    $orchestrationEditorRunButtonDisplayStateStore,
  );

  $effect(() => {
    setInputPanelContext({
      onCreateJsonTemplateDraft,
      onDirectMode,
      onExecute,
      onImportFile,
      onLoadJsonTemplate,
      onPreview,
      onTemplateMode,
    });
  });
</script>

<div class="grid gap-2">
  <TabList
    tabItems={txTemplateModeTabs}
    activeValue={orchestrationInputDisplay.activeMode}
    aria-label={orchestrationInputDisplay.tabAriaLabel}
    onSelect={selectMode}
  />
  {#if orchestrationInputDisplay.mode.isDirect}
    <Card.Root>
      <Card.Header>
        <Card.Title>{orchestrationInputDisplay.tabAriaLabel}</Card.Title>
      </Card.Header>
      <Card.Content class="grid gap-2">
        <div class="text-xs text-slate-500">
          {orchestrationInputDisplay.directHint}
        </div>
        <TxDirectVarsPanel
          active={directPanelActive}
          hidden-textarea={true}
          hintKey="orchestrationVarsHint"
          placeholderFallback={orchestrationVarsPlaceholder}
          placeholderKey="orchestrationVarsPlaceholder"
          prefix="orchestration-direct"
          varsKey={directVarsKey}
        />
      </Card.Content>
    </Card.Root>
  {:else if orchestrationInputDisplay.mode.isTemplate}
    <Card.Root>
      <Card.Header>
        <Card.Title>{orchestrationInputDisplay.tabAriaLabel}</Card.Title>
      </Card.Header>
      <Card.Content class="grid gap-2">
        <TxTemplateRunPanel
          active={templatePanelActive}
          hidden-textarea={true}
          hintKeys={[
            "orchestrationTemplateRunHint",
            "orchestrationTemplateEditHint",
          ]}
          onCreateTemplateDraft={createTemplateDraft}
          onDeleteTemplate={onDeleteJsonTemplate}
          onLoadTemplate={loadJsonTemplate}
          onSaveTemplate={onSaveJsonTemplate}
          templateKind={TX_TEMPLATE_KIND.orchestration}
          varsKey={templateVarsKey}
          varsPlaceholderFallback={orchestrationTemplateVarsPlaceholder}
          varsPlaceholderKey="orchestrationVarsPlaceholder"
          varsPrefix="orchestration-template"
        />
      </Card.Content>
    </Card.Root>
  {/if}
  <OrchestrationEditorRunPanel
    {active}
    editorSyncVersion={orchestrationEditorSyncVersion}
    {orchestrationEditorRunButtonDisplay}
    onCreateDraft={createJsonDraft}
    {onEditorInput}
    onExecute={executeOrchestration}
    onImportFile={importFile}
    onPreview={previewOrchestration}
  />
</div>

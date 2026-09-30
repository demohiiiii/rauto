<script lang="ts">
  import { getContext } from "svelte";
  import { readonlyFieldsContextKey } from "$lib/svelte.js";
  import ReadonlyFields from "$components/fragments/ReadonlyFields.svelte";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button/index.js";
  import TemplateSourceField from "$components/fragments/TemplateSourceField.svelte";
  import TemplateSourceActions from "$components/fragments/TemplateSourceActions.svelte";
  import TemplateSaveDialog from "$components/fragments/TemplateSaveDialog.svelte";
  import JsonObjectFieldsEditor from "$components/fragments/JsonObjectFieldsEditor.svelte";
  import StatusCard from "$components/fragments/StatusCard.svelte";
  import { t } from "$lib/i18n.js";
  import TxBlockVisualEditor from "../block/TxBlockVisualEditor.svelte";
  import TxJsonFormSurface from "../shared/TxJsonFormSurface.svelte";
  import type {
    TransactionBlockTemplateAuthoring,
    TransactionEditorView,
    TxWorkflowBlockActionHandlers,
    TxWorkflowBlockRow,
    TxWorkflowVisualEditorDisplay,
  } from "$domains/transactions/index.js";

  interface Props {
    blockActionHandlers: TxWorkflowBlockActionHandlers;
    blockRow: TxWorkflowBlockRow;
    editorDisplay: TxWorkflowVisualEditorDisplay;
    templateWorkspace: TransactionBlockTemplateAuthoring;
    showRemoveAction?: boolean;
  }
  let {
    blockRow,
    editorDisplay,
    blockActionHandlers,
    templateWorkspace,
    showRemoveAction = true,
  }: Props = $props();
  const inheritedReadonly = getContext<(() => boolean) | undefined>(
    readonlyFieldsContextKey,
  );
  let contentReadyStore = $derived(templateWorkspace.contentReadyStateStore);
  let contentReady = $derived($contentReadyStore);
  let displayStore = $derived(templateWorkspace.displayStateStore);
  let formStore = $derived(templateWorkspace.formStateStore);
  let jsonStore = $derived(templateWorkspace.jsonTextStateStore);
  let display = $derived($displayStore);
  let form = $derived($formStore);
  let json = $derived($jsonStore);
  let busy = $derived(!!display.loadingAction || !!inheritedReadonly?.());
  let editorView = $state<TransactionEditorView>("form");
  $effect(() => {
    void templateWorkspace.initialize();
  });
</script>

<Card.Root
  size="sm"
  class={showRemoveAction
    ? "min-w-0 gap-0 overflow-hidden py-0 data-[size=sm]:py-0"
    : "min-w-0 gap-0 border-0 bg-transparent py-0 shadow-none ring-0 data-[size=sm]:py-0"}
>
  {#if showRemoveAction}
    <Card.Header class="border-b bg-muted/15 p-4 sm:p-5">
      <Card.Title>{blockRow.titleText}</Card.Title>
      <Card.Action>
        <ReadonlyFields>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onclick={blockActionHandlers.remove}>{t("deleteBtn")}</Button
          >
        </ReadonlyFields>
      </Card.Action>
    </Card.Header>
  {/if}
  <Card.Content
    class={showRemoveAction
      ? "grid min-w-0 gap-4 p-4"
      : "grid min-w-0 gap-4 p-0 group-data-[size=sm]/card:px-0"}
  >
    <TemplateSourceField
      value={display.selectedName}
      optionValues={display.templateNames}
      disabled={busy}
      onValueChange={templateWorkspace.selectTemplate}
    >
      {#snippet actions()}
        <TemplateSourceActions
          readonly={display.readonly}
          editing={display.editing}
          busy={busy || !contentReady}
          saving={display.loadingAction.startsWith("save")}
          canSave={!form.formError}
          onEdit={templateWorkspace.startEditing}
          onCopy={templateWorkspace.copyToManual}
          onSave={templateWorkspace.saveTemplate}
          onCancel={templateWorkspace.cancelEditing}
        />
      {/snippet}
    </TemplateSourceField>
    {#if display.errorMessage}<StatusCard
        message={display.errorMessage}
        tone="error"
      />{/if}
    {#if !contentReady && display.errorMessage}
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onclick={() => templateWorkspace.initialize()}>{t("refreshBtn")}</Button
      >
    {/if}
    {#if blockRow.showTemplateRef || display.selectedName}
      <ReadonlyFields disabled={busy}>
        <JsonObjectFieldsEditor
          title={t("txWorkflowFormBlockTemplateVars")}
          source={blockRow.block.templateRef.txBlockTemplateVars || {}}
          typeRows={[...editorDisplay.jsonValueTypeRows]}
          onChange={templateWorkspace.changeVariables}
        />
      </ReadonlyFields>
    {/if}
    <TxJsonFormSurface
      active={true}
      editorKind="inline"
      editorDisplayMode={editorView}
      editorValue={json}
      editorTitle={blockRow.titleText}
      readonly={display.readonly || busy}
      formError={form.formError}
      formErrorDetail={form.formErrorDetail}
      hostClass="tx-json-editor tx-json-editor-compact"
      tabItems={[
        { value: "form", labelKey: "txBlockEditorFormTab" },
        { value: "json", labelKey: "txBlockEditorJsonTab" },
      ]}
      onEditorViewSelect={(view) => {
        editorView = view;
      }}
      onInlineEditorChange={templateWorkspace.changeJson}
      immediateEditorInput
    >
      {#snippet formContent()}
        {#if form.formModel}
          <ReadonlyFields disabled={display.readonly || busy} scopeOnly>
            <TxBlockVisualEditor
              model={form.formModel}
              onChange={templateWorkspace.changeFormModel}
            />
          </ReadonlyFields>
        {/if}
      {/snippet}
    </TxJsonFormSurface>
  </Card.Content>
</Card.Root>

<TemplateSaveDialog
  open={display.nameDialog.open}
  value={display.nameDialog.value}
  error={display.nameDialog.error || display.errorMessage}
  {busy}
  onChange={templateWorkspace.changeNameDialogValue}
  onClose={templateWorkspace.closeNameDialog}
  onSave={templateWorkspace.submitNameDialog}
/>

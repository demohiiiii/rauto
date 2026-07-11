<script>
  import JsonTextEditor from "../../components/fragments/JsonTextEditor.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import TabList from "../../components/fragments/TabList.svelte";
  import { txBlockEditorViewTabs } from "../../config/dashboardModes.js";
  import { TX_EDITOR } from "../../modules/transactionPanelState.js";
  import TxJsonEditor from "./TxJsonEditor.svelte";

  let {
    active = true,
    editorDisplayMode = "form",
    editorKind = "tx-host",
    editorKey = TX_EDITOR.txBlock,
    editorValue = "",
    editorTitle = "",
    editorTheme = "",
    formContent,
    formError = "",
    hostClass = "tx-json-editor",
    jsonHintText = "",
    onEditorInput,
    onInlineEditorChange,
    onEditorViewSelect,
    placeholder = "",
  } = $props();

  let editorPlaceholder = $derived(placeholder);
  let editorAriaLabel = $derived(placeholder || editorTitle);
  let showInlineEditor = $derived(editorKind === "inline");
</script>

<div class="grid gap-2">
  <TabList
    tabItems={txBlockEditorViewTabs}
    activeValue={editorDisplayMode}
    aria-label={editorTitle || placeholder}
    onSelect={onEditorViewSelect}
  />
  {#if formError}
    <StatusCard message={formError} tone="warning" variant="alert" />
  {/if}
  {#if editorDisplayMode === "form"}
    {@render formContent()}
  {:else}
    {#if jsonHintText}
      <div class="text-xs text-slate-500">{jsonHintText}</div>
    {/if}
    {#if showInlineEditor}
      <JsonTextEditor
        {active}
        class={hostClass}
        aria-label={editorAriaLabel}
        {placeholder}
        theme={editorTheme}
        value={editorValue}
        onChange={onInlineEditorChange}
      />
    {:else}
      <TxJsonEditor
        {active}
        {editorKey}
        host-class={hostClass}
        placeholder={editorPlaceholder}
        aria-label={editorAriaLabel}
        value={editorValue}
        onInput={onEditorInput}
      />
    {/if}
  {/if}
</div>

<script lang="ts">
  import type { Snippet } from "svelte";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import JsonTextEditor from "$components/fragments/JsonTextEditor.svelte";
  import StatusCard from "$components/fragments/StatusCard.svelte";
  import TabList from "$components/fragments/TabList.svelte";
  import { txBlockEditorViewTabs } from "$config/dashboardModes.js";
  import { callIfFunction } from "$lib/events.js";
  import { currentLanguageState, t } from "$lib/i18n.js";
  import { TX_EDITOR } from "$domains/transactions/index.js";
  import type {
    JsonErrorDetail,
    TransactionEditorSyncStatus,
    TransactionEditorView,
    TxEditorKey,
  } from "$domains/transactions/index.js";
  import TxJsonEditor from "$domains/transactions/presentation/components/shared/TxJsonEditor.svelte";

  interface TabItem {
    label?: string;
    labelKey?: string;
    value: string;
  }

  interface Props {
    active?: boolean;
    editorDisplayMode?: TransactionEditorView;
    editorKind?: "inline" | "tx-host";
    editorKey?: TxEditorKey;
    editorValue?: string;
    editorTitle?: string;
    editorTheme?: string;
    fillEditorHeight?: boolean;
    formContent?: Snippet;
    formError?: string;
    formErrorDetail?: JsonErrorDetail | null;
    hostClass?: string;
    immediateEditorInput?: boolean;
    jsonHintText?: string;
    navigationMode?: "hidden" | "tabs";
    onEditorInput?: ((text: string) => void) | null;
    onEditorViewSelect?: (view: TransactionEditorView) => boolean | void;
    onInlineEditorChange?: ((text: string) => void) | null;
    placeholder?: string;
    readonlyContent?: Snippet;
    syncStatus?: TransactionEditorSyncStatus;
    syncStatusText?: string;
    syncStatusTone?: "muted" | "primary" | "warning";
    tabItems?: readonly TabItem[];
  }

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
    formErrorDetail = null,
    fillEditorHeight = false,
    hostClass = "tx-json-editor",
    immediateEditorInput = false,
    jsonHintText = "",
    onEditorInput,
    onInlineEditorChange,
    onEditorViewSelect,
    placeholder = "",
    readonlyContent = undefined,
    navigationMode = "tabs",
    syncStatus = "synced",
    syncStatusText = "",
    syncStatusTone = "primary",
    tabItems = txBlockEditorViewTabs,
  }: Props = $props();

  let editorHost = $state<HTMLElement>();
  let currentLanguage = $derived($currentLanguageState);
  let editorPlaceholder = $derived(placeholder);
  let editorAriaLabel = $derived(placeholder || editorTitle);
  let showInlineEditor = $derived(editorKind === "inline");
  let hideNavigation = $derived(navigationMode === "hidden");
  let syncBadgeVariant = $derived<"default" | "destructive" | "secondary">(
    syncStatusTone === "warning"
      ? "destructive"
      : syncStatusTone === "muted"
        ? "secondary"
        : "default",
  );
  let formErrorLocation = $derived.by(() => {
    currentLanguage;
    if (formErrorDetail?.line == null || formErrorDetail?.column == null) {
      return "";
    }
    return t("txEditorErrorLocation")
      .replace("{line}", String(formErrorDetail.line))
      .replace("{column}", String(formErrorDetail.column));
  });

  function selectEditorView(nextView: string): boolean | void | undefined {
    if (nextView !== "form" && nextView !== "json" && nextView !== "readonly") {
      return;
    }
    const selected = callIfFunction(onEditorViewSelect, nextView);
    if (selected === false) {
      requestAnimationFrame(() => {
        editorHost
          ?.querySelector<HTMLElement>(
            '.cm-content, [contenteditable="true"], textarea',
          )
          ?.focus();
      });
    }
    return selected;
  }
</script>

<div
  class={fillEditorHeight
    ? "flex h-full min-h-0 flex-col gap-2"
    : "grid min-h-0 gap-2"}
>
  {#if !hideNavigation}
    <div class="flex min-w-0 flex-wrap items-center gap-2">
      <TabList
        {tabItems}
        activeValue={editorDisplayMode}
        aria-label={editorTitle || placeholder}
        onSelect={selectEditorView}
      />
      {#if syncStatusText}
        <Badge
          role="status"
          aria-live="polite"
          variant={syncBadgeVariant}
          data-sync-status={syncStatus}>{syncStatusText}</Badge
        >
      {/if}
    </div>
  {:else if editorDisplayMode === "json" && syncStatusText}
    <div class="flex min-w-0 justify-end">
      <Badge
        role="status"
        aria-live="polite"
        variant={syncBadgeVariant}
        data-sync-status={syncStatus}>{syncStatusText}</Badge
      >
    </div>
  {/if}
  {#if formError}
    <StatusCard message={formError} tone="warning" variant="alert">
      <div class="grid gap-1">
        <span class="break-all whitespace-pre-wrap">{formError}</span>
        {#if formErrorLocation}
          <span class="text-xs">{formErrorLocation}</span>
        {/if}
      </div>
    </StatusCard>
  {/if}
  {#if editorDisplayMode === "form"}
    {@render formContent?.()}
  {:else if editorDisplayMode === "readonly" && readonlyContent}
    {@render readonlyContent()}
  {:else}
    <div
      bind:this={editorHost}
      class={fillEditorHeight
        ? "grid min-h-0 flex-1 gap-2"
        : "grid min-h-0 gap-2"}
    >
      {#if jsonHintText}
        <div class="text-xs text-slate-500">{jsonHintText}</div>
      {/if}
      {#if showInlineEditor}
        <JsonTextEditor
          {active}
          class={hostClass}
          aria-label={editorAriaLabel}
          fill={fillEditorHeight}
          immediate={immediateEditorInput}
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
    </div>
  {/if}
</div>

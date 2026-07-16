<script>
  import * as Alert from "$lib/components/ui/alert";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { Textarea } from "$lib/components/ui/textarea";
  import {
    BracesIcon,
    CheckIcon,
    CopyPlusIcon,
    FileCode2Icon,
    FilePlus2Icon,
    RefreshCwIcon,
    SearchIcon,
    SaveIcon,
    Trash2Icon,
  } from "@lucide/svelte";
  import { untrack } from "svelte";
  import { CommandFlowAuthoringViews } from "../../components/command-flow/index.js";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import { browserConfirm } from "../../lib/browser.js";
  import { currentLanguageState, t } from "../../lib/i18n.js";
  import { cn } from "$lib/utils.js";
  import { showToast } from "../../modules/overlays.js";
  import { createCommandFlowDraftWorkspace } from "../../modules/commandFlowDraftState.js";
  import { commandFlowTemplateModelToToml } from "../../modules/commandFlowTemplateModel.js";
  import {
    MODE_SELECT,
    modeSelection,
    refreshExecutionModeOptionsForCurrentConnection,
  } from "../../modules/profiles.js";
  import {
    TEMPLATE_MANAGER_KIND,
    templateResourceDefinitions,
  } from "../../modules/templateManagerState.js";

  let { definition, workspace } = $props();
  const { filteredItemsStore, stateStore } = untrack(() => workspace);
  const flowDraftWorkspace = createCommandFlowDraftWorkspace();
  const {
    activeTabStateStore: flowEditorTabStateStore,
    errorStateStore: flowDraftErrorStateStore,
    modelStateStore: flowDraftModelStateStore,
    tomlTextStateStore: flowDraftTomlStateStore,
  } = flowDraftWorkspace;
  const flowModeStateStore = modeSelection(MODE_SELECT.standardFlow).state;
  let state = $derived($stateStore);
  let filteredItems = $derived($filteredItemsStore);
  let currentLanguage = $derived($currentLanguageState);
  let nameDialog = $state({ open: false, mode: "new", value: "", error: "" });
  let flowDraftModel = $derived($flowDraftModelStateStore);
  let flowDraftToml = $derived($flowDraftTomlStateStore);
  let flowDraftError = $derived($flowDraftErrorStateStore);
  let flowEditorTab = $derived($flowEditorTabStateStore);
  let flowModeState = $derived($flowModeStateStore);
  let flowModeOptions = $derived(
    Array.isArray(flowModeState?.modes) ? flowModeState.modes : [],
  );
  let flowModesPrepared = false;

  let labels = $derived.by(() => {
    currentLanguage;
    return {
      title: t(definition.labelKey),
      description: t(definition.descriptionKey),
      search: t("templateManagerSearchPlaceholder"),
      newResource: t("templateManagerNewResource"),
      save: t("templateSaveBtn"),
      saveAs: t("flowSaveAsButton"),
      delete: t("templateDeleteBtn"),
      refresh: t("blacklistRefreshBtn"),
      format: t("templateManagerFormatJson"),
      emptyTitle: t("templateManagerEmptyTitle"),
      emptyHint: t("templateManagerEmptyHint"),
      editorEmptyTitle: t("templateManagerEditorEmptyTitle"),
      editorEmptyHint: t("templateManagerEditorEmptyHint"),
      content: t("templateManagerContentLabel"),
      builtin: t("builtinLabel"),
      custom: t("templateManagerCustomLabel"),
      draft: t("templateManagerDraftLabel"),
      saved: t("templateManagerSavedLabel"),
      unsaved: t("templateManagerUnsavedLabel"),
      variables: t("templateManagerVariablesLabel"),
      noVariables: t("templateManagerNoVariables"),
      cancel: t("cancelBtn"),
      confirm: t("confirmBtn"),
      newDialogTitle: t("templateManagerNewDialogTitle"),
      saveAsDialogTitle: t("templateManagerSaveAsDialogTitle"),
      nameDialogDescription: t("templateManagerNameDialogDescription"),
      namePlaceholder: t("templateManagerNamePlaceholder"),
      deleteConfirm: t("templateManagerDeleteConfirm"),
      requestFailed: t("requestFailed"),
      lines: t("templateManagerLinesLabel"),
      immutableHint: t("templateManagerNameImmutableHint"),
      name: t("fieldName"),
      flowParseTitle: t("templateManagerFlowParseTitle"),
      flowTomlLabel: t("flowTomlLabel"),
      flowTomlHint: t("flowTomlHint"),
    };
  });

  let format = $derived(
    templateResourceDefinitions[state.kind]?.format || "text",
  );
  let selected = $derived(state.selected);
  let canSave = $derived(
    !!selected &&
      !selected.builtin &&
      (selected.isDraft || state.dirty) &&
      !(state.kind === TEMPLATE_MANAGER_KIND.flow && flowDraftError),
  );
  let busy = $derived(!!state.loadingAction);
  let lineCount = $derived(
    state.content ? state.content.split("\n").length : 0,
  );
  let byteCount = $derived(
    new TextEncoder().encode(state.content || "").length,
  );

  function openNameDialog(mode) {
    nameDialog = {
      open: true,
      mode,
      value: mode === "saveAs" && selected ? `${selected.name}-copy` : "",
      error: "",
    };
  }

  function setNameDialogOpen(open) {
    nameDialog = { ...nameDialog, open: !!open, error: "" };
  }

  async function submitNameDialog() {
    const result =
      nameDialog.mode === "saveAs"
        ? await workspace.saveAs(nameDialog.value)
        : await workspace.createDraft(nameDialog.value);
    if (!result?.ok) {
      if (!result?.cancelled) {
        nameDialog = {
          ...nameDialog,
          error: result?.message || labels.requestFailed,
        };
      }
      return;
    }
    setNameDialogOpen(false);
  }

  async function saveTemplate() {
    const result = await workspace.save();
    showToast(
      result?.ok ? `${t("saved")}: ${result.name}` : result?.message,
      result?.ok ? "success" : "error",
    );
  }

  async function deleteTemplate() {
    if (
      !selected ||
      !browserConfirm(`${labels.deleteConfirm} ${selected.name}?`)
    )
      return;
    const result = await workspace.deleteSelected();
    showToast(
      result?.ok ? `${t("deleted")}: ${result.name}` : result?.message,
      result?.ok ? "success" : "error",
    );
  }

  function formatJson() {
    const result = workspace.formatContent();
    if (!result.ok && result.message) showToast(result.message, "error");
  }

  function changeFlowModel(model) {
    if (selected?.builtin) return;
    flowDraftWorkspace.setModel(model);
    workspace.setContent(commandFlowTemplateModelToToml(model));
  }

  function changeFlowToml(tomlText) {
    if (selected?.builtin) return false;
    const valid = flowDraftWorkspace.setTomlText(tomlText);
    workspace.setContent(tomlText);
    return valid;
  }

  function timestampText(timestamp) {
    if (!timestamp) return "";
    try {
      return new Intl.DateTimeFormat(
        currentLanguage === "en" ? "en" : "zh-CN",
        {
          dateStyle: "medium",
          timeStyle: "short",
        },
      ).format(new Date(timestamp));
    } catch (_) {
      return "";
    }
  }

  $effect(() => {
    if (state.kind !== TEMPLATE_MANAGER_KIND.flow || !selected) return;
    if (state.content === flowDraftToml) return;
    flowDraftWorkspace.setTomlText(state.content);
  });

  $effect(() => {
    if (state.kind !== TEMPLATE_MANAGER_KIND.flow || flowModesPrepared) return;
    flowModesPrepared = true;
    void refreshExecutionModeOptionsForCurrentConnection();
  });
</script>

<div class="flex min-w-0 flex-col gap-4">
  <header
    class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
  >
    <div class="min-w-0">
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="text-lg font-semibold tracking-tight text-foreground">
          {labels.title}
        </h3>
        <Badge variant="secondary">{state.items.length}</Badge>
        <Badge variant="outline">{format.toUpperCase()}</Badge>
      </div>
      <p class="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
        {labels.description}
      </p>
    </div>
    <div class="flex shrink-0 flex-wrap items-center gap-2">
      <LoadingButton
        variant="outline"
        size="sm"
        loading={state.loadingAction === "list"}
        disabled={busy}
        onclick={workspace.refresh}
      >
        <RefreshCwIcon data-icon="inline-start" />
        <span>{labels.refresh}</span>
      </LoadingButton>
      <Button size="sm" onclick={() => openNameDialog("new")} disabled={busy}>
        <FilePlus2Icon data-icon="inline-start" />
        {labels.newResource}
      </Button>
    </div>
  </header>

  {#if state.errorMessage}
    <Alert.Root variant="destructive">
      <Alert.Title>{labels.requestFailed}</Alert.Title>
      <Alert.Description>{state.errorMessage}</Alert.Description>
    </Alert.Root>
  {/if}

  <div class="grid min-w-0 gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
    <Card.Root class="min-w-0 self-start overflow-hidden shadow-xs">
      <Card.Header class="border-b bg-muted/20 pb-4">
        <div class="relative">
          <SearchIcon
            class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            class="pl-9"
            value={state.search}
            placeholder={labels.search}
            aria-label={labels.search}
            oninput={(event) => workspace.setSearch(event.currentTarget.value)}
          />
        </div>
      </Card.Header>
      <Card.Content class="flex flex-col gap-2 p-2">
        {#if state.loadingAction === "list" && !state.loaded}
          {#each Array(4) as _}
            <Skeleton class="h-16 w-full rounded-lg" />
          {/each}
        {:else if !filteredItems.length}
          <div class="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <div
              class="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"
            >
              <FileCode2Icon aria-hidden="true" />
            </div>
            <div>
              <p class="text-sm font-medium text-foreground">
                {labels.emptyTitle}
              </p>
              <p class="mt-1 text-xs leading-5 text-muted-foreground">
                {labels.emptyHint}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onclick={() => openNameDialog("new")}
            >
              <FilePlus2Icon data-icon="inline-start" />
              {labels.newResource}
            </Button>
          </div>
        {:else}
          {#each filteredItems as item (item.key)}
            <button
              type="button"
              class={cn(
                "group flex min-h-16 w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-border hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected?.key === item.key && "border-primary/30 bg-primary/8",
              )}
              onclick={() => workspace.selectResource(item.key)}
            >
              <span
                class={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
                  selected?.key === item.key && "bg-primary/12 text-primary",
                )}
              >
                <FileCode2Icon aria-hidden="true" />
              </span>
              <span class="min-w-0 flex-1">
                <span
                  class="block truncate text-sm font-medium text-foreground"
                >
                  {item.name}
                </span>
                <span
                  class="mt-1 flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <span>{item.builtin ? labels.builtin : labels.custom}</span>
                  {#if item.size_bytes}
                    <span aria-hidden="true">·</span>
                    <span>{item.size_bytes} B</span>
                  {/if}
                </span>
              </span>
              {#if selected?.key === item.key}
                <CheckIcon class="size-4 text-primary" aria-hidden="true" />
              {/if}
            </button>
          {/each}
        {/if}
      </Card.Content>
    </Card.Root>

    <Card.Root class="min-w-0 overflow-hidden shadow-xs">
      {#if !selected}
        <Card.Content
          class="flex min-h-72 flex-col items-center justify-center gap-3 text-center sm:min-h-[34rem]"
        >
          <div
            class="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground"
          >
            <FileCode2Icon aria-hidden="true" />
          </div>
          <div>
            <p class="font-medium text-foreground">{labels.editorEmptyTitle}</p>
            <p class="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
              {labels.editorEmptyHint}
            </p>
          </div>
        </Card.Content>
      {:else}
        <Card.Header class="border-b bg-muted/15">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <Card.Title class="truncate text-base">{selected.name}</Card.Title
              >
              <Badge variant={selected.builtin ? "outline" : "secondary"}>
                {selected.builtin
                  ? labels.builtin
                  : selected.isDraft
                    ? labels.draft
                    : labels.custom}
              </Badge>
              <Badge variant={state.dirty ? "destructive" : "outline"}>
                {state.dirty ? labels.unsaved : labels.saved}
              </Badge>
            </div>
            <Card.Description class="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              <span>{lineCount} {labels.lines}</span>
              <span>{byteCount} B</span>
              {#if selected.updated_at_ms}
                <span>{timestampText(selected.updated_at_ms)}</span>
              {/if}
            </Card.Description>
          </div>
          <Card.Action class="flex flex-wrap justify-end gap-2">
            {#if format === "json"}
              <Button
                variant="ghost"
                size="sm"
                onclick={formatJson}
                disabled={busy}
              >
                <BracesIcon data-icon="inline-start" />
                {labels.format}
              </Button>
            {/if}
            <Button
              variant="outline"
              size="sm"
              onclick={() => openNameDialog("saveAs")}
              disabled={busy ||
                (state.kind === TEMPLATE_MANAGER_KIND.flow && !!flowDraftError)}
            >
              <CopyPlusIcon data-icon="inline-start" />
              {labels.saveAs}
            </Button>
            {#if !selected.builtin}
              <LoadingButton
                size="sm"
                loading={state.loadingAction === "save" ||
                  state.loadingAction === "create"}
                disabled={!canSave || busy}
                onclick={saveTemplate}
              >
                <SaveIcon data-icon="inline-start" />
                <span>{labels.save}</span>
              </LoadingButton>
            {/if}
          </Card.Action>
        </Card.Header>
        <Card.Content class="flex min-w-0 flex-col gap-4 p-4">
          {#if state.varsSchema.length}
            <div class="rounded-lg border bg-muted/20 p-3">
              <div
                class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                {labels.variables}
              </div>
              <div class="flex flex-wrap gap-2">
                {#each state.varsSchema as field (field.name)}
                  <Badge variant="outline">{field.name}</Badge>
                {/each}
              </div>
            </div>
          {:else if state.kind === "command" || state.kind === "flow"}
            <div class="text-xs text-muted-foreground">
              {labels.noVariables}
            </div>
          {/if}

          {#if state.kind === TEMPLATE_MANAGER_KIND.flow}
            {#if flowDraftError}
              <Alert.Root variant="destructive">
                <Alert.Title>{labels.flowParseTitle}</Alert.Title>
                <Alert.Description>{flowDraftError}</Alert.Description>
              </Alert.Root>
            {/if}
            <div
              class="min-w-0 overflow-hidden rounded-xl border border-border"
            >
              <CommandFlowAuthoringViews
                activeTab={flowEditorTab}
                ariaLabel={labels.content}
                disabled={selected.builtin}
                model={flowDraftModel}
                modeOptions={flowModeOptions}
                tomlLabel={labels.flowTomlLabel}
                tomlHint={labels.flowTomlHint}
                tomlText={flowDraftToml}
                onSelectTab={flowDraftWorkspace.selectTab}
                onModelChange={changeFlowModel}
                onTomlChange={changeFlowToml}
              />
            </div>
          {:else}
            <div class="flex min-w-0 flex-col gap-2">
              <Label for="template-manager-content">{labels.content}</Label>
              <Textarea
                id="template-manager-content"
                class="min-h-80 resize-y whitespace-pre font-mono text-[0.86rem] leading-6 sm:min-h-[30rem]"
                value={state.content}
                readonly={selected.builtin}
                spellcheck="false"
                oninput={(event) =>
                  workspace.setContent(event.currentTarget.value)}
              />
            </div>
          {/if}
        </Card.Content>
        {#if !selected.builtin && !selected.isDraft}
          <Card.Footer class="justify-between border-t bg-muted/10">
            <p class="text-xs text-muted-foreground">
              {labels.immutableHint}
            </p>
            <LoadingButton
              variant="destructive"
              size="sm"
              loading={state.loadingAction === "delete"}
              disabled={busy}
              onclick={deleteTemplate}
            >
              <Trash2Icon data-icon="inline-start" />
              <span>{labels.delete}</span>
            </LoadingButton>
          </Card.Footer>
        {/if}
      {/if}
    </Card.Root>
  </div>
</div>

<Dialog.Root open={nameDialog.open} onOpenChange={setNameDialogOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>
        {nameDialog.mode === "saveAs"
          ? labels.saveAsDialogTitle
          : labels.newDialogTitle}
      </Dialog.Title>
      <Dialog.Description>{labels.nameDialogDescription}</Dialog.Description>
    </Dialog.Header>
    <div class="flex flex-col gap-2">
      <Label for="template-manager-name">{labels.name}</Label>
      <Input
        id="template-manager-name"
        value={nameDialog.value}
        placeholder={labels.namePlaceholder}
        aria-invalid={!!nameDialog.error}
        oninput={(event) =>
          (nameDialog = {
            ...nameDialog,
            value: event.currentTarget.value,
            error: "",
          })}
        onkeydown={(event) => event.key === "Enter" && submitNameDialog()}
      />
      {#if nameDialog.error}
        <p class="text-sm text-destructive" role="alert">{nameDialog.error}</p>
      {/if}
    </div>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => setNameDialogOpen(false)}>
        {labels.cancel}
      </Button>
      <Button onclick={submitNameDialog}>{labels.confirm}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

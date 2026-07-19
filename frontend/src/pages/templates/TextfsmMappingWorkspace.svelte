<script>
  import * as Alert from "$lib/components/ui/alert";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import {
    ArrowRightIcon,
    CheckIcon,
    FilePlus2Icon,
    Link2Icon,
    RefreshCwIcon,
    SaveIcon,
    SearchIcon,
    Trash2Icon,
  } from "@lucide/svelte";
  import { untrack } from "svelte";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import PlainSelectField from "../../components/fragments/PlainSelectField.svelte";
  import { browserConfirm } from "../../lib/browser.js";
  import { currentLanguageState, t } from "../../lib/i18n.js";
  import { cn } from "$lib/utils.js";
  import { showToast } from "../../modules/overlays/overlays.js";

  let { definition, workspace } = $props();
  const { filteredMappingsStore, stateStore } = untrack(() => workspace);
  let state = $derived($stateStore);
  let mappings = $derived($filteredMappingsStore);
  let currentLanguage = $derived($currentLanguageState);
  let labels = $derived.by(() => {
    currentLanguage;
    return {
      title: t(definition.labelKey),
      description: t(definition.descriptionKey),
      search: t("templateManagerMappingSearch"),
      newResource: t("templateManagerNewMapping"),
      profile: t("templateManagerProfileLabel"),
      command: t("fieldCommand"),
      template: t("templateManagerTextfsmTemplateLabel"),
      save: t("templateSaveBtn"),
      delete: t("templateDeleteBtn"),
      refresh: t("blacklistRefreshBtn"),
      emptyTitle: t("templateManagerMappingEmptyTitle"),
      emptyHint: t("templateManagerMappingEmptyHint"),
      editorTitle: t("templateManagerMappingEditorTitle"),
      editorHint: t("templateManagerMappingEditorHint"),
      deleteConfirm: t("templateManagerMappingDeleteConfirm"),
      requestFailed: t("requestFailed"),
      commandPlaceholder: t("textfsmMappingCommandPlaceholder"),
      mappingHint: t("textfsmMappingHint"),
    };
  });
  let busy = $derived(!!state.loadingAction);
  let selectedIdentity = $derived(state.originalIdentity);
  let profileOptions = $derived(
    state.profiles.map((profile) => ({
      optionValue: profile,
      optionLabel: profile,
    })),
  );
  let templateOptions = $derived(
    state.templates.map((template) => ({
      optionValue: template,
      optionLabel: template,
    })),
  );

  async function saveMapping() {
    const result = await workspace.save();
    showToast(
      result.ok ? t("saved") : result.message,
      result.ok ? "success" : "error",
    );
  }

  async function deleteMapping() {
    if (!browserConfirm(labels.deleteConfirm)) return;
    const result = await workspace.remove();
    showToast(
      result.ok ? t("deleted") : result.message,
      result.ok ? "success" : "error",
    );
  }
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
        <Badge variant="secondary">{state.mappings.length}</Badge>
      </div>
      <p class="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
        {labels.description}
      </p>
    </div>
    <div class="flex shrink-0 flex-wrap gap-2">
      <LoadingButton
        variant="outline"
        size="sm"
        loading={state.loadingAction === "load"}
        disabled={busy}
        onclick={workspace.load}
      >
        <RefreshCwIcon data-icon="inline-start" />
        <span>{labels.refresh}</span>
      </LoadingButton>
      <Button size="sm" onclick={workspace.createDraft} disabled={busy}>
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

  <div
    class="grid min-w-0 gap-4 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(28rem,1.2fr)]"
  >
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
        {#if !mappings.length}
          <div class="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <div
              class="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"
            >
              <Link2Icon aria-hidden="true" />
            </div>
            <div>
              <p class="text-sm font-medium text-foreground">
                {labels.emptyTitle}
              </p>
              <p class="mt-1 text-xs leading-5 text-muted-foreground">
                {labels.emptyHint}
              </p>
            </div>
          </div>
        {:else}
          {#each mappings as mapping (`${mapping.deviceProfile}:${mapping.command}`)}
            {@const identity = `${mapping.deviceProfile}\u0000${mapping.command}`}
            <button
              type="button"
              class={cn(
                "flex min-h-20 w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-border hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selectedIdentity === identity &&
                  "border-primary/30 bg-primary/8",
              )}
              onclick={() => workspace.select(mapping)}
            >
              <span
                class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
              >
                <Link2Icon aria-hidden="true" />
              </span>
              <span class="min-w-0 flex-1">
                <span
                  class="flex items-center gap-1.5 text-sm font-medium text-foreground"
                >
                  <span class="truncate">{mapping.deviceProfile}</span>
                  <ArrowRightIcon
                    class="size-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span class="truncate">{mapping.templateName}</span>
                </span>
                <span
                  class="mt-1 block truncate font-mono text-xs text-muted-foreground"
                >
                  {mapping.command}
                </span>
              </span>
              {#if selectedIdentity === identity}
                <CheckIcon class="size-4 text-primary" aria-hidden="true" />
              {/if}
            </button>
          {/each}
        {/if}
      </Card.Content>
    </Card.Root>

    <Card.Root class="min-w-0 overflow-hidden shadow-xs">
      <Card.Header class="border-b bg-muted/15">
        <Card.Title class="text-base">{labels.editorTitle}</Card.Title>
        <Card.Description>{labels.editorHint}</Card.Description>
      </Card.Header>
      <Card.Content class="flex flex-col gap-5 p-5">
        <div class="grid gap-5 md:grid-cols-2">
          <div class="flex min-w-0 flex-col gap-2">
            <Label>{labels.profile}</Label>
            <PlainSelectField
              value={state.form.deviceProfile}
              optionRows={profileOptions}
              title={labels.profile}
              aria-label={labels.profile}
              onValueChange={(value) =>
                workspace.patchForm({ deviceProfile: value })}
            />
          </div>
          <div class="flex min-w-0 flex-col gap-2">
            <Label>{labels.template}</Label>
            <PlainSelectField
              value={state.form.templateName}
              optionRows={templateOptions}
              title={labels.template}
              aria-label={labels.template}
              onValueChange={(value) =>
                workspace.patchForm({ templateName: value })}
            />
          </div>
        </div>
        <div class="flex min-w-0 flex-col gap-2">
          <Label for="textfsm-mapping-command">{labels.command}</Label>
          <Input
            id="textfsm-mapping-command"
            class="font-mono"
            value={state.form.command}
            placeholder={labels.commandPlaceholder}
            oninput={(event) =>
              workspace.patchForm({ command: event.currentTarget.value })}
          />
        </div>
      </Card.Content>
      <Card.Footer class="flex-wrap justify-between gap-3 border-t bg-muted/10">
        <p class="max-w-lg text-xs leading-5 text-muted-foreground">
          {labels.mappingHint}
        </p>
        <div class="flex gap-2">
          {#if state.originalIdentity}
            <LoadingButton
              variant="destructive"
              size="sm"
              loading={state.loadingAction === "delete"}
              disabled={busy}
              onclick={deleteMapping}
            >
              <Trash2Icon data-icon="inline-start" />
              <span>{labels.delete}</span>
            </LoadingButton>
          {/if}
          <LoadingButton
            size="sm"
            loading={state.loadingAction === "save"}
            disabled={busy}
            onclick={saveMapping}
          >
            <SaveIcon data-icon="inline-start" />
            <span>{labels.save}</span>
          </LoadingButton>
        </div>
      </Card.Footer>
    </Card.Root>
  </div>
</div>

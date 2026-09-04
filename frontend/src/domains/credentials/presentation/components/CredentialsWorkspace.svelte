<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import WorkspaceActionHeader from "$components/fragments/WorkspaceActionHeader.svelte";
  import CredentialImportDialog from "./CredentialImportDialog.svelte";
  import CredentialAuthFields from "./CredentialAuthFields.svelte";
  import {
    credentialAuthTypeLabel,
    credentialDeleteBlockedMessage,
    createCredentialsPageWorkspace,
    type CredentialForm,
    type CredentialImportReport,
  } from "../../index.js";
  import { t } from "$lib/i18n.js";
  import { cn } from "$lib/utils.js";
  import KeyRoundIcon from "@lucide/svelte/icons/key-round";
  import Link2Icon from "@lucide/svelte/icons/link-2";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SaveIcon from "@lucide/svelte/icons/save";
  import SearchIcon from "@lucide/svelte/icons/search";
  import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";

  let { active }: { active: boolean } = $props();
  const workspace = createCredentialsPageWorkspace();
  const { displayStateStore } = workspace;
  let display = $derived($displayStateStore);
  let filteredCredentials = $derived(display.filteredCredentials);
  let form = $derived(display.form);
  let loading = $derived(display.loading);
  let saving = $derived(display.saving);
  let searchQuery = $derived(display.searchQuery);
  let selectedId = $derived(display.selectedId);
  let status = $derived(display.status);

  $effect(() => {
    void workspace.setPageContext({ active });
  });

  function selectCredential(id: string): Promise<void> {
    return workspace.selectCredential(id);
  }

  function resetForm(): void {
    workspace.resetForm();
  }

  function save(): Promise<void> {
    return workspace.save();
  }

  function remove(): Promise<void> {
    return workspace.remove();
  }

  function handleCredentialsImported(
    report: CredentialImportReport,
  ): Promise<void> {
    return workspace.handleImported(report);
  }

  function handleSearch(event: Event): void {
    workspace.setSearchQuery((event.currentTarget as HTMLInputElement).value);
  }

  function setEnableEnabled(checked: boolean): void {
    workspace.setEnableEnabled(checked);
  }

  function authTypeLabel(authType: CredentialForm["authType"]): string {
    return credentialAuthTypeLabel(authType, t);
  }
</script>

<div class="flex flex-col gap-4" hidden={!active}>
  <Card.Root class="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
    <WorkspaceActionHeader
      title={t("credentialsTitle")}
      description={t("credentialsDescription")}
      icon={KeyRoundIcon}
    />
    <div
      class="grid min-h-[38rem] overflow-hidden lg:grid-cols-[17rem_minmax(0,1fr)]"
    >
      <aside
        class="flex min-h-0 flex-col border-b border-border bg-muted/15 lg:border-r lg:border-b-0"
      >
        <div class="flex shrink-0 flex-col gap-2 border-b border-border p-3">
          <div class="relative">
            <SearchIcon
              class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              class="h-9 rounded-lg pl-9 text-sm"
              value={searchQuery}
              placeholder={t("credentialSearchPlaceholder")}
              aria-label={t("credentialSearchPlaceholder")}
              oninput={handleSearch}
            />
          </div>
          <Button
            variant="default"
            size="sm"
            class="w-full rounded-lg"
            onclick={resetForm}
          >
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            {t("credentialNew")}
          </Button>
          <CredentialImportDialog onImported={handleCredentialsImported} />
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto p-1.5">
          {#if loading}
            <p class="p-4 text-sm text-muted-foreground">{t("loading")}</p>
          {:else if filteredCredentials.length}
            <div class="flex flex-col gap-1">
              {#each filteredCredentials as item (item.id)}
                <button
                  type="button"
                  class={cn(
                    "w-full rounded-lg border p-2 text-left transition-colors",
                    selectedId === item.id
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:bg-background",
                  )}
                  onclick={() => selectCredential(item.id)}
                >
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <p class="truncate text-[13px] font-semibold">
                        {item.name}
                      </p>
                      <p
                        class="mt-0.5 truncate font-mono text-[11px] text-muted-foreground"
                      >
                        {item.username}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      class="shrink-0 rounded-full px-1.5 py-0 text-[10px]"
                      >{item.connectionCount}</Badge
                    >
                  </div>
                  <div
                    class="mt-1.5 flex flex-wrap gap-1 text-[10px] text-muted-foreground"
                  >
                    <span class="rounded-md bg-secondary px-1.5 py-0.5">
                      {authTypeLabel(item.authType)}
                    </span>
                    {#if item.enableEnabled}<span
                        class="rounded-md bg-secondary px-1.5 py-0.5"
                        >Enable</span
                      >{/if}
                  </div>
                </button>
              {/each}
            </div>
          {:else}
            <div class="p-6 text-center text-sm text-muted-foreground">
              {t("credentialEmpty")}
            </div>
          {/if}
        </div>
      </aside>

      <section class="min-w-0 overflow-y-auto bg-background p-4 sm:p-6">
        <div class="mx-auto flex max-w-3xl flex-col gap-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p
                class="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                {selectedId
                  ? t("credentialEditLabel")
                  : t("credentialNewLabel")}
              </p>
              <h2 class="mt-1 text-xl font-semibold tracking-tight">
                {form.name || t("credentialUntitled")}
              </h2>
            </div>
            {#if selectedId}
              <Button
                variant="ghost"
                size="sm"
                class="text-destructive hover:text-destructive"
                disabled={form.referencingConnections.length > 0}
                title={form.referencingConnections.length
                  ? credentialDeleteBlockedMessage(form.referencingConnections)
                  : t("credentialDelete")}
                onclick={remove}
              >
                <Trash2Icon data-icon="inline-start" aria-hidden="true" />
                {t("credentialDelete")}
              </Button>
            {/if}
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <label class="grid gap-1.5 sm:col-span-2"
              ><span class="text-xs font-semibold text-muted-foreground"
                >{t("credentialName")}</span
              ><Input
                value={form.name}
                oninput={(event) =>
                  workspace.patchForm({ name: event.currentTarget.value })}
              /></label
            >
            <label class="grid gap-1.5 sm:col-span-2"
              ><span class="text-xs font-semibold text-muted-foreground"
                >{t("credentialUsername")}</span
              ><Input
                value={form.username}
                oninput={(event) =>
                  workspace.patchForm({ username: event.currentTarget.value })}
              /></label
            >
            <CredentialAuthFields
              {form}
              editing={Boolean(selectedId)}
              onChange={workspace.patchForm}
            />
            <label
              class="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-3 text-sm sm:col-span-2"
            >
              <Checkbox
                checked={form.enableEnabled}
                onCheckedChange={setEnableEnabled}
              />
              <span>{t("credentialEnableEnabled")}</span>
            </label>
            {#if form.enableEnabled}
              <label class="grid gap-1.5 sm:col-span-2"
                ><span class="text-xs font-semibold text-muted-foreground"
                  >{t("credentialEnablePassword")}</span
                ><Input
                  type="password"
                  value={form.enablePassword}
                  oninput={(event) =>
                    workspace.patchForm({
                      enablePassword: event.currentTarget.value,
                    })}
                  placeholder={form.hasEnablePassword
                    ? t("credentialEnableBlankEnter")
                    : t("credentialEnableOptional")}
                /></label
              >
            {/if}
          </div>

          {#if form.connectionCount}
            <div class="rounded-xl border border-border bg-muted/20 p-4">
              <div class="flex items-center gap-2 text-sm font-semibold">
                <Link2Icon class="size-4 text-primary" aria-hidden="true" />{t(
                  "credentialReferences",
                )}
                <Badge variant="secondary">{form.connectionCount}</Badge>
              </div>
              <div
                class="mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground"
              >
                {#each form.referencingConnections as name}<span
                    class="rounded-md bg-background px-2 py-1 font-mono"
                    >{name}</span
                  >{/each}
              </div>
            </div>
          {:else}
            <div
              class="rounded-xl border border-dashed border-primary/25 bg-primary/5 p-4 text-sm text-muted-foreground"
            >
              <ShieldCheckIcon
                class="mr-2 inline size-4 text-primary"
                aria-hidden="true"
              />{t("credentialNoReferences")}
            </div>
          {/if}

          {#if status.text}<p
              class={status.tone === "error"
                ? "text-sm text-destructive"
                : "text-sm text-primary"}
            >
              {status.text}
            </p>{/if}
          <div class="flex justify-end">
            <Button disabled={saving} onclick={save}
              ><SaveIcon data-icon="inline-start" aria-hidden="true" />{saving
                ? t("credentialSavingAction")
                : t("credentialSaveAction")}</Button
            >
          </div>
        </div>
      </section>
    </div>
  </Card.Root>
</div>

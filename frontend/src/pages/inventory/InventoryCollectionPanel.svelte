<script>
  import * as Card from "$lib/components/ui/card";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Spinner } from "$lib/components/ui/spinner";
  import {
    ChevronRightIcon,
    ListTreeIcon,
    PlusIcon,
    SaveIcon,
    SearchIcon,
    TagIcon,
    Trash2Icon,
  } from "@lucide/svelte";
  import PlainCheckboxField from "../../components/fragments/PlainCheckboxField.svelte";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import { browserConfirm } from "../../lib/browser.js";
  import { inventoryCollectionActionHandlers } from "../../modules/inventory/inventoryPageWorkspace.js";

  let {
    collectionDisplay,
    onClearHosts,
    onCreateDraft,
    onDelete,
    onDescriptionInput,
    onHostFilter,
    onHostSelection,
    onSave,
    onSelectAllHosts,
    onSelectCollection,
  } = $props();

  let active = $derived(collectionDisplay.active);
  let collectionList = $derived(collectionDisplay.listDisplay);
  let editorDisplay = $derived(collectionDisplay.editorDisplay);
  let collectionSearch = $state("");
  let createDialogOpen = $state(false);
  let createDialogName = $state("");
  let createDialogError = $state("");
  let createDialogSubmitting = $state(false);
  let filteredCollectionRows = $derived.by(() => {
    const query = collectionSearch.trim().toLowerCase();
    if (!query) return collectionList.collectionRows;
    return collectionList.collectionRows.filter((row) =>
      [row.nameText, row.descriptionText, row.hostBadgeText]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  });
  let actionHandlers = $derived(
    inventoryCollectionActionHandlers({
      onDescriptionInput,
      onHostFilter,
      onHostSelection,
      onSelectCollection,
    }),
  );

  function updateCollectionSearch(event) {
    collectionSearch = event.currentTarget.value;
  }

  function confirmDelete() {
    if (!editorDisplay.canEdit) return;
    if (browserConfirm(collectionList.deleteConfirmText)) onDelete();
  }

  function openCreateDialog() {
    createDialogName = "";
    createDialogError = "";
    createDialogOpen = true;
  }

  function setCreateDialogOpen(open) {
    if (createDialogSubmitting && !open) return;
    createDialogOpen = open;
  }

  function updateCreateDialogName(event) {
    createDialogName = event.currentTarget.value;
    if (createDialogError) createDialogError = "";
  }

  async function submitCreateDialog(event) {
    event.preventDefault();
    const normalizedName = createDialogName.trim();
    if (!normalizedName) {
      createDialogError = collectionList.newNameRequiredMessage;
      return;
    }
    createDialogSubmitting = true;
    try {
      await onCreateDraft(normalizedName);
      createDialogOpen = false;
    } finally {
      createDialogSubmitting = false;
    }
  }
</script>

<div class="min-w-0" hidden={!active}>
  <Card.Root class="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
    <Card.Header class="border-b bg-card/80 p-4 sm:p-5">
      <div class="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div class="flex min-w-0 items-start gap-3">
          <div
            class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
          >
            {#if collectionList.showGroupFields}
              <ListTreeIcon aria-hidden="true" />
            {:else}
              <TagIcon aria-hidden="true" />
            {/if}
          </div>
          <div class="min-w-0">
            <Card.Title>{collectionList.collectionTitle}</Card.Title>
            <Card.Description class="mt-1 max-w-2xl leading-6">
              {collectionList.collectionDescription}
            </Card.Description>
          </div>
        </div>
        <Button
          class="min-h-10"
          variant="outline"
          type="button"
          onclick={openCreateDialog}
        >
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
          {collectionList.newButtonLabel}
        </Button>
      </div>
    </Card.Header>

    <Card.Content class="min-w-0 p-0">
      <div
        class="grid min-w-0 lg:grid-cols-[minmax(15rem,20rem)_minmax(0,1fr)]"
      >
        <aside
          class="min-w-0 border-b bg-muted/10 p-4 lg:border-r lg:border-b-0 sm:p-5"
          aria-label={collectionList.collectionTitle}
        >
          <div class="flex items-center justify-between gap-2">
            <div class="text-xs font-semibold uppercase text-muted-foreground">
              {collectionList.collectionTitle}
            </div>
            <Badge variant="secondary">
              {collectionList.collectionCount}
              <span class="sr-only">{collectionList.collectionCountLabel}</span>
            </Badge>
          </div>

          <div class="relative mt-3">
            <SearchIcon
              class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              class="h-10 pl-9"
              value={collectionSearch}
              aria-label={collectionList.catalogSearchPlaceholder}
              placeholder={collectionList.catalogSearchPlaceholder}
              oninput={updateCollectionSearch}
            />
          </div>

          <div
            class="mt-3 grid max-h-[28rem] min-h-24 gap-1 overflow-y-auto pr-1 lg:max-h-[calc(100dvh-22rem)]"
          >
            {#if !collectionList.hasItems}
              <div
                class="flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed border-border px-3 py-6 text-center"
              >
                <div
                  class="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                >
                  {#if collectionList.showGroupFields}
                    <ListTreeIcon aria-hidden="true" />
                  {:else}
                    <TagIcon aria-hidden="true" />
                  {/if}
                </div>
                <div class="mt-3 text-sm font-semibold">
                  {collectionList.emptyTitle}
                </div>
                <div class="mt-1 text-xs leading-5 text-muted-foreground">
                  {collectionList.emptyStatus.message}
                </div>
              </div>
            {:else if filteredCollectionRows.length === 0}
              <div
                class="rounded-lg border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground"
              >
                {collectionList.noMatchText}
              </div>
            {:else}
              {#each filteredCollectionRows as collectionRow (collectionRow.name)}
                <button
                  type="button"
                  class={collectionRow.buttonClass}
                  aria-current={collectionRow.selected ? "true" : undefined}
                  onclick={actionHandlers.collectionSelectAction(
                    collectionRow.name,
                  )}
                >
                  <div class="flex min-w-0 items-start gap-2">
                    <div class="min-w-0 flex-1">
                      <div class="flex min-w-0 items-center gap-2">
                        <span
                          class="min-w-0 flex-1 truncate font-mono text-xs font-semibold text-foreground"
                        >
                          {collectionRow.nameText}
                        </span>
                        <Badge
                          variant={collectionRow.selected
                            ? "default"
                            : "secondary"}
                        >
                          {collectionRow.hostBadgeText}
                        </Badge>
                      </div>
                      {#if collectionRow.showDescription}
                        <div class="mt-1 line-clamp-2 text-xs leading-5">
                          {collectionRow.descriptionText}
                        </div>
                      {/if}
                    </div>
                    <ChevronRightIcon
                      class="mt-0.5 size-4 shrink-0 opacity-50 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </div>
                </button>
              {/each}
            {/if}
          </div>
        </aside>

        <section class="min-w-0 p-4 sm:p-5 lg:p-6" aria-live="polite">
          <div
            class="flex min-w-0 flex-wrap items-start justify-between gap-3 border-b border-border pb-4"
          >
            <div class="min-w-0">
              <div class="text-xs font-medium text-muted-foreground">
                {collectionList.editorTitle}
              </div>
              <h2 class="mt-1 break-words font-mono text-lg font-semibold">
                {editorDisplay.collectionNameText}
              </h2>
              <p class="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                {collectionList.editorDescription}
              </p>
            </div>
            <div class="flex flex-wrap items-center justify-end gap-2">
              <Button
                class="min-h-10"
                variant="outline"
                type="button"
                disabled={!editorDisplay.canEdit}
                onclick={onSave}
              >
                <SaveIcon data-icon="inline-start" aria-hidden="true" />
                {collectionList.saveButtonLabel}
              </Button>
              <Button
                class="min-h-10"
                variant="destructive"
                type="button"
                disabled={!editorDisplay.canEdit}
                onclick={confirmDelete}
              >
                <Trash2Icon data-icon="inline-start" aria-hidden="true" />
                {collectionList.deleteButtonLabel}
              </Button>
            </div>
          </div>

          {#if editorDisplay.canEdit}
            <div class="mt-5 grid gap-5">
              <div class={editorDisplay.identityGridClass}>
                <div class="grid gap-1.5">
                  <label
                    for={`${collectionList.collectionTitle}-name`}
                    class="text-xs font-semibold text-foreground"
                  >
                    {editorDisplay.nameLabel}
                  </label>
                  <Input
                    id={`${collectionList.collectionTitle}-name`}
                    value={editorDisplay.collectionNameText}
                    readonly
                    aria-readonly="true"
                  />
                </div>
                {#if editorDisplay.showGroupFields}
                  <div class="grid gap-1.5">
                    <label
                      for={`${collectionList.collectionTitle}-description`}
                      class="text-xs font-semibold text-foreground"
                    >
                      {editorDisplay.descriptionLabel}
                    </label>
                    <PlainInputField
                      id={`${collectionList.collectionTitle}-description`}
                      value={editorDisplay.descriptionValue}
                      placeholderText={editorDisplay.descriptionPlaceholder}
                      onValueInput={actionHandlers.descriptionChangeHandler}
                    />
                  </div>
                {/if}
              </div>

              <div class="grid gap-2">
                <div class="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <div class="text-sm font-semibold">
                      {editorDisplay.hostsLabel}
                    </div>
                    <div class="mt-1 text-xs text-muted-foreground">
                      {editorDisplay.selectedHostCount} / {editorDisplay.hostCount}
                    </div>
                  </div>
                  <div class="flex flex-wrap items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onclick={onSelectAllHosts}
                    >
                      {editorDisplay.selectAllHostsButtonLabel}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onclick={onClearHosts}
                    >
                      {editorDisplay.clearHostsButtonLabel}
                    </Button>
                  </div>
                </div>
                <div class="relative">
                  <SearchIcon
                    class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <PlainInputField
                    class="pl-9"
                    value={editorDisplay.hostFilterValue}
                    placeholderText={editorDisplay.hostFilterPlaceholder}
                    onValueInput={actionHandlers.hostFilterChangeHandler}
                  />
                </div>
                <div
                  class="grid max-h-80 min-h-32 gap-1 overflow-auto rounded-lg border border-border bg-muted/10 p-2"
                >
                  {#each editorDisplay.hostRows as hostRow (hostRow.name)}
                    <PlainCheckboxField
                      class="flex min-h-10 cursor-pointer justify-start gap-2 rounded-md px-2 py-2 hover:bg-muted"
                      textClass="text-sm font-medium text-foreground"
                      afterText={!hostRow.available
                        ? editorDisplay.hostMissingSuffix
                        : ""}
                      afterTextClass="text-xs text-amber-600"
                      aria-label={hostRow.name}
                      value={hostRow.name}
                      checked={hostRow.selected}
                      labelText={hostRow.name}
                      onCheckedChange={actionHandlers.hostSelectionToggleHandler(
                        hostRow.name,
                      )}
                    />
                  {/each}
                  {#if !editorDisplay.hasFilteredHosts}
                    <div
                      class="flex min-h-24 items-center justify-center px-3 text-center text-xs text-muted-foreground"
                    >
                      {editorDisplay.emptyText}
                    </div>
                  {/if}
                </div>
              </div>

              {#if editorDisplay.showStatus}
                <StatusCard
                  message={editorDisplay.statusMessage}
                  tone={editorDisplay.statusTone}
                />
              {/if}
            </div>
          {:else}
            <div
              class="flex min-h-72 flex-col items-center justify-center px-6 text-center"
            >
              <div
                class="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground"
              >
                {#if collectionList.showGroupFields}
                  <ListTreeIcon aria-hidden="true" />
                {:else}
                  <TagIcon aria-hidden="true" />
                {/if}
              </div>
              <h3 class="mt-4 text-sm font-semibold">
                {collectionList.selectionHint}
              </h3>
              <p class="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                {collectionList.editorDescription}
              </p>
            </div>
          {/if}
        </section>
      </div>
    </Card.Content>
  </Card.Root>
</div>

<Dialog.Root open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
  <Dialog.Content class="w-[calc(100vw-2rem)] sm:max-w-md">
    <form class="grid gap-4" onsubmit={submitCreateDialog}>
      <Dialog.Header>
        <Dialog.Title>{collectionList.newDialogTitle}</Dialog.Title>
        <Dialog.Description>
          {collectionList.newDialogDescription}
        </Dialog.Description>
      </Dialog.Header>

      <div class="grid gap-2 py-2">
        <Label for={`inventory-${collectionList.kind}-create-name`}>
          {collectionList.newNameLabel}
        </Label>
        <Input
          id={`inventory-${collectionList.kind}-create-name`}
          value={createDialogName}
          placeholder={collectionList.newNamePlaceholder}
          aria-invalid={createDialogError ? "true" : undefined}
          autofocus
          oninput={updateCreateDialogName}
        />
        {#if createDialogError}
          <p class="text-sm text-destructive" role="alert">
            {createDialogError}
          </p>
        {/if}
      </div>

      <Dialog.Footer>
        <Button
          variant="outline"
          type="button"
          disabled={createDialogSubmitting}
          onclick={() => setCreateDialogOpen(false)}
        >
          {collectionList.cancelButtonLabel}
        </Button>
        <Button type="submit" disabled={createDialogSubmitting}>
          {#if createDialogSubmitting}
            <Spinner data-icon="inline-start" aria-hidden="true" />
          {/if}
          {collectionList.confirmButtonLabel}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<script>
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button/index.js";
  import PlainCheckboxField from "../../components/fragments/PlainCheckboxField.svelte";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import StringSelectField from "../../components/fragments/StringSelectField.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import { inventoryCollectionActionHandlers } from "../../modules/inventoryPageWorkspace.js";
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
  let actionHandlers = $derived(
    inventoryCollectionActionHandlers({
      onDescriptionInput,
      onHostFilter,
      onHostSelection,
      onSelectCollection,
    }),
  );
</script>

{#snippet collectionListPanel()}
  <Card.Content class="grid gap-3">
    <StringSelectField
      title={collectionList.selectPlaceholder}
      aria-label={collectionList.selectPlaceholder}
      value={collectionList.selectedValue}
      optionValues={collectionList.optionNames}
      placeholderText={collectionList.selectPlaceholder}
      onValueChange={actionHandlers.collectionChangeHandler}
    />
    <div class="grid gap-2">
      {#if !collectionList.hasItems}
        <StatusCard
          message={collectionList.emptyStatus.message}
          tone={collectionList.emptyStatus.tone}
        />
      {:else}
        {#each collectionList.collectionRows as collectionRow}
          <button
            type="button"
            class={collectionRow.buttonClass}
            onclick={actionHandlers.collectionSelectAction(collectionRow.name)}
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-sm font-semibold text-slate-800">
                {collectionRow.nameText}
              </span>
              <span class={collectionRow.hostBadgeClass}>
                {collectionRow.hostBadgeText}
              </span>
            </div>
            {#if collectionRow.showDescription}
              <div class="mt-1 text-xs text-slate-500">
                {collectionRow.descriptionText}
              </div>
            {/if}
          </button>
        {/each}
      {/if}
    </div>
  </Card.Content>
{/snippet}

{#snippet editorLabel(labelText)}
  <span class="text-xs font-semibold text-slate-500">
    {labelText}
  </span>
{/snippet}

{#snippet hostSelectionSection()}
  <div class="grid gap-1">
    {@render editorLabel(editorDisplay.hostsLabel)}
    <div class="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
      <PlainInputField
        value={editorDisplay.hostFilterValue}
        placeholderText={editorDisplay.hostFilterPlaceholder}
        onValueInput={actionHandlers.hostFilterChangeHandler}
      />
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onclick={onSelectAllHosts}
      >
        {editorDisplay.selectAllHostsButtonLabel}
      </Button>
      <Button variant="ghost" size="sm" type="button" onclick={onClearHosts}>
        {editorDisplay.clearHostsButtonLabel}
      </Button>
    </div>
    <div
      class="min-h-40 max-h-72 overflow-auto rounded-lg border border-border bg-card p-2"
    >
      {#each editorDisplay.hostRows as hostRow}
        <PlainCheckboxField
          class="flex cursor-pointer justify-start gap-2 rounded-lg px-2 py-1 hover:bg-muted"
          textClass="text-sm font-medium text-foreground"
          afterText={!hostRow.available ? editorDisplay.hostMissingSuffix : ""}
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
    </div>
    {#if !editorDisplay.hasFilteredHosts}
      <div class="text-xs text-slate-500">
        {editorDisplay.emptyText}
      </div>
    {/if}
  </div>
{/snippet}

<div class="mt-4 grid gap-3 xl:grid-cols-[0.9fr_1.1fr]" hidden={!active}>
  <Card.Root>
    <Card.Header>
      <Card.Title>
        {collectionList.collectionTitle}
      </Card.Title>
    </Card.Header>
    {@render collectionListPanel()}
  </Card.Root>

  <Card.Root>
    <Card.Header>
      <Card.Title>
        {collectionList.editorTitle}
      </Card.Title>
      <Card.Action>
        <div class="inline-flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onclick={onCreateDraft}
          >
            {collectionList.newButtonLabel}
          </Button>
          <Button variant="default" size="sm" type="button" onclick={onSave}>
            {collectionList.saveButtonLabel}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            type="button"
            onclick={onDelete}
          >
            {collectionList.deleteButtonLabel}
          </Button>
        </div>
      </Card.Action>
    </Card.Header>
    <Card.Content class="grid gap-3">
      <div class={editorDisplay.identityGridClass}>
        <div class="grid gap-1">
          {@render editorLabel(editorDisplay.nameLabel)}
          <div
            class="border-border bg-background flex h-9 items-center rounded-md border px-2.5 py-1 text-sm shadow-xs"
          >
            {editorDisplay.collectionNameText}
          </div>
        </div>
        {#if editorDisplay.showGroupFields}
          <div class="grid gap-1">
            {@render editorLabel(editorDisplay.descriptionLabel)}
            <PlainInputField
              value={editorDisplay.descriptionValue}
              placeholderText={editorDisplay.descriptionPlaceholder}
              onValueInput={actionHandlers.descriptionChangeHandler}
            />
          </div>
        {/if}
      </div>

      {@render hostSelectionSection()}
      <div class="grid gap-2">
        {#if editorDisplay.showStatus}
          <StatusCard
            message={editorDisplay.statusMessage}
            tone={editorDisplay.statusTone}
          />
        {/if}
      </div>
    </Card.Content>
  </Card.Root>
</div>

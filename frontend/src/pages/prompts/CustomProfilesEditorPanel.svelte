<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import {
    PlusIcon,
    SaveIcon,
    Settings2Icon,
    Trash2Icon,
    WorkflowIcon,
  } from "@lucide/svelte";
  import CollapsibleGroup from "../../components/fragments/CollapsibleGroup.svelte";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import StringSelectField from "../../components/fragments/StringSelectField.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import ValueTextSelectField from "../../components/fragments/ValueTextSelectField.svelte";
  import { currentLanguageState, t } from "../../lib/i18n.js";
  import { createCustomProfilesEditorWorkspace } from "../../modules/profiles/profiles.js";
  import CustomProfileDetectPanel from "./CustomProfileDetectPanel.svelte";
  import ProfileHookRowEditor from "./ProfileHookRowEditor.svelte";
  import ProfileListRowEditor from "./ProfileListRowEditor.svelte";

  let {
    active,
    customStatusMessage,
    customStatusTone,
    customTitle,
    hooksHint,
    hooksTitle,
    onProfileIdentityChange,
    showProfilePicker = true,
    showCustomStatus,
  } = $props();

  const customProfilesEditorWorkspace = createCustomProfilesEditorWorkspace();
  const {
    commandExecutionModeChangeHandler,
    createDraft,
    deleteProfile,
    hookAddHandler,
    hookRowCallbacks,
    profileHookSectionDisplaysStateStore,
    profileListAddHandler,
    profileListRowCallbacks,
    profileListSectionDisplaysStateStore,
    profileListRowsStateStore,
    saveProfile,
    selectedProfileChangeHandler,
    settingsDisplayStateStore,
    shellExitMarkerChangeHandler,
  } = customProfilesEditorWorkspace;

  let currentLanguage = $derived($currentLanguageState);
  let lastReportedProfileName = $state(null);
  let profileListSectionDisplays = $derived(
    $profileListSectionDisplaysStateStore,
  );
  let profileHookSectionDisplays = $derived(
    $profileHookSectionDisplaysStateStore,
  );
  let simpleProfileListSections = $derived(
    profileListSectionDisplays.filter((section) => section.kind === "simple"),
  );
  let structuredProfileListSections = $derived(
    profileListSectionDisplays.filter((section) => section.kind !== "simple"),
  );
  let settingsDisplay = $derived($settingsDisplayStateStore);
  let labels = $derived.by(() => {
    currentLanguage;
    return {
      commandDescription: t("profileCommandExecutionDescription"),
      configurationDescription: t("profileConfigurationDescription"),
      configurationTitle: t("profileConfigurationTitle"),
      hooksDescription: t("profileHooksDescription"),
      rulesEmpty: t("profileRulesEmpty"),
      workspaceDescription: t("profileCustomWorkspaceDescription"),
    };
  });

  function actionLabel(label = "") {
    return String(label).replace(/^\+\s*/, "");
  }

  $effect(() => {
    const profileName = settingsDisplay.selectedProfileName;
    if (
      showProfilePicker ||
      profileName === lastReportedProfileName ||
      typeof onProfileIdentityChange !== "function"
    ) {
      return;
    }
    lastReportedProfileName = profileName;
    onProfileIdentityChange(profileName);
  });
</script>

{#snippet profileListSectionEditor(profileListSection)}
  <CollapsibleGroup
    variant="section"
    class="px-4 py-4"
    label={profileListSection.titleText}
    persistenceKey={profileListSection.persistenceKey}
    toggle-mode="icon"
    body-class="mt-3 grid gap-2"
  >
    {#snippet header()}
      <div class="flex min-w-0 flex-1 items-center justify-between gap-2">
        <div class="flex min-w-0 flex-1 items-center gap-2">
          <span class="min-w-0 break-words text-xs font-semibold sm:text-sm">
            {profileListSection.titleText}
          </span>
          <span
            class="flex min-w-6 items-center justify-center rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
          >
            {$profileListRowsStateStore[profileListSection.listKey].length}
          </span>
        </div>
        <Button
          class="size-10 shrink-0 sm:h-9 sm:w-auto"
          type="button"
          variant="primary-outline"
          size="sm"
          aria-label={actionLabel(profileListSection.addButtonLabel)}
          onclick={profileListAddHandler(
            profileListSection.listKey,
            profileListSection.kind,
          )}
        >
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
          <span class="hidden sm:inline">
            {actionLabel(profileListSection.addButtonLabel)}
          </span>
        </Button>
      </div>
    {/snippet}

    {#each $profileListRowsStateStore[profileListSection.listKey] as profileListRow, profileListRowIndex}
      <ProfileListRowEditor
        idPrefix={profileListSection.persistenceKey}
        kind={profileListSection.kind}
        {...profileListRowCallbacks(
          profileListSection.listKey,
          profileListSection.kind,
        )}
        {profileListRow}
        rowIndex={profileListRowIndex}
      />
    {/each}
    {#if $profileListRowsStateStore[profileListSection.listKey].length === 0}
      <div
        class="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground"
      >
        {labels.rulesEmpty}
      </div>
    {/if}
  </CollapsibleGroup>
{/snippet}

<div class="grid min-w-0 gap-5">
  <section
    class="grid gap-4 border-b border-border pb-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end"
  >
    <div class="min-w-0">
      <h2 class="text-base font-semibold">{customTitle}</h2>
      <p class="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
        {labels.workspaceDescription}
      </p>
      {#if showProfilePicker}
        <div class="mt-4 max-w-xl">
          <StringSelectField
            class="h-10"
            title={settingsDisplay.selectPlaceholder}
            aria-label={settingsDisplay.selectPlaceholder}
            value={settingsDisplay.selectedProfileName}
            optionValues={settingsDisplay.profileNames}
            placeholderText={settingsDisplay.selectPlaceholder}
            onValueChange={selectedProfileChangeHandler()}
          />
        </div>
      {/if}
    </div>

    <div class="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end">
      <Button
        class="min-h-10"
        variant="outline"
        type="button"
        onclick={createDraft}
      >
        <PlusIcon data-icon="inline-start" aria-hidden="true" />
        {settingsDisplay.newButtonLabel}
      </Button>
      <Button class="min-h-10" type="button" onclick={saveProfile}>
        <SaveIcon data-icon="inline-start" aria-hidden="true" />
        {settingsDisplay.saveButtonLabel}
      </Button>
      <Button
        class="min-h-10"
        variant="destructive"
        type="button"
        disabled={!settingsDisplay.selectedProfileName}
        onclick={deleteProfile}
      >
        <Trash2Icon data-icon="inline-start" aria-hidden="true" />
        {settingsDisplay.deleteButtonLabel}
      </Button>
    </div>

    {#if showCustomStatus}
      <div class="xl:col-span-2" aria-live="polite">
        <StatusCard message={customStatusMessage} tone={customStatusTone} />
      </div>
    {/if}
  </section>

  <section class="overflow-hidden rounded-lg border border-border bg-card/50">
    <header class="flex items-start gap-3 border-b border-border px-4 py-4">
      <div
        class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
      >
        <Settings2Icon class="size-4" aria-hidden="true" />
      </div>
      <div class="min-w-0">
        <h3 class="text-sm font-semibold">
          {settingsDisplay.commandExecutionTitle}
        </h3>
        <p class="mt-1 text-xs leading-5 text-muted-foreground">
          {labels.commandDescription}
        </p>
      </div>
    </header>
    <div class="grid gap-3 p-4 md:max-w-2xl md:grid-cols-2">
      <ValueTextSelectField
        title={settingsDisplay.commandExecutionTitle}
        aria-label={settingsDisplay.commandExecutionTitle}
        value={settingsDisplay.commandExecutionMode}
        optionRows={settingsDisplay.commandExecutionModeOptionRows}
        onValueChange={commandExecutionModeChangeHandler()}
      />
      <PlainInputField
        value={settingsDisplay.commandExecutionMarker}
        placeholderText={settingsDisplay.commandExecutionMarkerPlaceholder}
        onValueInput={shellExitMarkerChangeHandler()}
        disabled={!settingsDisplay.showShellExitMarker}
        hidden={!settingsDisplay.showShellExitMarker}
      />
    </div>
  </section>

  <CustomProfileDetectPanel {active} />

  <section class="overflow-hidden rounded-lg border border-border bg-card/50">
    <header class="flex items-start gap-3 border-b border-border px-4 py-4">
      <div
        class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
      >
        <WorkflowIcon class="size-4" aria-hidden="true" />
      </div>
      <div class="min-w-0">
        <h3 class="text-sm font-semibold">{labels.configurationTitle}</h3>
        <p class="mt-1 text-xs leading-5 text-muted-foreground">
          {labels.configurationDescription}
        </p>
      </div>
    </header>

    <div
      class="grid lg:grid-cols-2 lg:[&>section:nth-child(odd)]:border-r lg:[&>section:nth-child(odd)]:border-border"
    >
      {#each simpleProfileListSections as profileListSection (profileListSection.listKey)}
        {@render profileListSectionEditor(profileListSection)}
      {/each}
    </div>
    <div class="border-t border-border">
      {#each structuredProfileListSections as profileListSection (profileListSection.listKey)}
        {@render profileListSectionEditor(profileListSection)}
      {/each}
    </div>
  </section>

  <section class="overflow-hidden rounded-lg border border-border bg-card/50">
    <header class="flex items-start gap-3 border-b border-border px-4 py-4">
      <div
        class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
      >
        <WorkflowIcon class="size-4" aria-hidden="true" />
      </div>
      <div class="min-w-0">
        <h3 class="text-sm font-semibold">{hooksTitle}</h3>
        <p class="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
          {labels.hooksDescription}
          {hooksHint}
        </p>
      </div>
    </header>
    <div class="grid min-w-0 gap-4 p-4">
      {#each profileHookSectionDisplays as hookSection (hookSection.listKey)}
        <section
          class="min-w-0 overflow-hidden rounded-md border border-border bg-background"
        >
          <header
            class="flex min-w-0 items-center justify-between gap-3 border-b border-border bg-muted/30 px-3 py-3"
          >
            <div class="flex min-w-0 items-center gap-2">
              <span class="min-w-0 break-words text-xs font-semibold">
                {hookSection.titleText}
              </span>
              <span
                class="flex min-w-6 shrink-0 items-center justify-center rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
              >
                {hookSection.hookRows.length}
              </span>
            </div>
            <Button
              type="button"
              variant="primary-outline"
              size="sm"
              aria-label={hookSection.addButtonAriaLabel}
              onclick={hookAddHandler(hookSection.listKey)}
            >
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              {actionLabel(hookSection.addButtonLabel)}
            </Button>
          </header>
          <div
            class="grid min-w-0 gap-3 p-3"
            role="group"
            aria-label={hookSection.groupAriaLabel}
          >
            {#each hookSection.hookRows as hookRow, hookRowIndex}
              <ProfileHookRowEditor
                idPrefix={hookSection.sectionKey}
                modeOptions={hookSection.modeOptions}
                {...hookRowCallbacks(hookSection.listKey)}
                {hookRow}
                rowIndex={hookRowIndex}
                stateList={hookSection.stateList}
              />
            {/each}
            {#if hookSection.hookRows.length === 0}
              <div
                class="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground"
              >
                {labels.rulesEmpty}
              </div>
            {/if}
          </div>
        </section>
      {/each}
    </div>
  </section>
</div>

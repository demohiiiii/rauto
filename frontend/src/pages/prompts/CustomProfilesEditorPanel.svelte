<script>
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button/index.js";
  import CollapsibleGroup from "../../components/fragments/CollapsibleGroup.svelte";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import StringSelectField from "../../components/fragments/StringSelectField.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import ValueTextSelectField from "../../components/fragments/ValueTextSelectField.svelte";
  import { createCustomProfilesEditorWorkspace } from "../../modules/profiles.js";
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

  let profileListSectionDisplays = $derived(
    $profileListSectionDisplaysStateStore,
  );
  let profileHookSectionDisplays = $derived(
    $profileHookSectionDisplaysStateStore,
  );
  let settingsDisplay = $derived($settingsDisplayStateStore);
</script>

{#snippet customProfileSettings()}
  <div class="grid gap-2">
    <div class="grid gap-2 md:w-160">
      <div class="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
        <StringSelectField
          title={settingsDisplay.selectPlaceholder}
          aria-label={settingsDisplay.selectPlaceholder}
          value={settingsDisplay.selectedProfileName}
          optionValues={settingsDisplay.profileNames}
          placeholderText={settingsDisplay.selectPlaceholder}
          onValueChange={selectedProfileChangeHandler()}
        />
        <Button variant="outline" size="sm" type="button" onclick={createDraft}>
          {settingsDisplay.newButtonLabel}
        </Button>
        <Button variant="default" size="sm" type="button" onclick={saveProfile}>
          {settingsDisplay.saveButtonLabel}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          type="button"
          onclick={deleteProfile}
        >
          {settingsDisplay.deleteButtonLabel}
        </Button>
      </div>
    </div>

    <Card.Root>
      <Card.Header>
        <Card.Title>
          {settingsDisplay.commandExecutionTitle}
        </Card.Title>
      </Card.Header>
      <Card.Content class="grid gap-2">
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
      </Card.Content>
    </Card.Root>
  </div>
{/snippet}

<div class="mt-4">
  <h3 class="mb-2 text-sm font-semibold text-slate-700">
    {customTitle}
  </h3>

  <div class="mt-3 grid gap-2">
    {@render customProfileSettings()}
    <CustomProfileDetectPanel {active} />
    {#each profileListSectionDisplays as profileListSection (profileListSection.listKey)}
      <CollapsibleGroup
        persistenceKey={profileListSection.persistenceKey}
        body-class="grid gap-2"
      >
        {#snippet header()}
          <span class="text-sm font-semibold text-slate-700">
            {profileListSection.titleText}
          </span>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onclick={profileListAddHandler(
              profileListSection.listKey,
              profileListSection.kind,
            )}
          >
            {profileListSection.addButtonLabel}
          </Button>
        {/snippet}

        {#each $profileListRowsStateStore[profileListSection.listKey] as profileListRow, profileListRowIndex}
          <ProfileListRowEditor
            kind={profileListSection.kind}
            {...profileListRowCallbacks(
              profileListSection.listKey,
              profileListSection.kind,
            )}
            {profileListRow}
            rowIndex={profileListRowIndex}
          />
        {/each}
      </CollapsibleGroup>
    {/each}
    <Card.Root>
      <Card.Header>
        <Card.Title>
          {hooksTitle}
        </Card.Title>
      </Card.Header>
      <Card.Content class="grid gap-3">
        <div class="text-xs text-slate-500">{hooksHint}</div>
        {#each profileHookSectionDisplays as hookSection (hookSection.listKey)}
          <div class="grid gap-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-600">
                {hookSection.titleText}
              </span>
              <Button
                type="button"
                variant="outline"
                size="xs"
                aria-label={hookSection.addButtonAriaLabel}
                onclick={hookAddHandler(hookSection.listKey)}
              >
                {hookSection.addButtonLabel}
              </Button>
            </div>
            <div
              class="grid gap-2"
              role="group"
              aria-label={hookSection.groupAriaLabel}
            >
              {#each hookSection.hookRows as hookRow, hookRowIndex}
                <ProfileHookRowEditor
                  modeOptions={hookSection.modeOptions}
                  {...hookRowCallbacks(hookSection.listKey)}
                  {hookRow}
                  rowIndex={hookRowIndex}
                  stateList={hookSection.stateList}
                />
              {/each}
            </div>
          </div>
        {/each}
      </Card.Content>
    </Card.Root>

    {#if showCustomStatus}
      <div class="mt-3 grid gap-2">
        <StatusCard message={customStatusMessage} tone={customStatusTone} />
      </div>
    {/if}
  </div>
</div>

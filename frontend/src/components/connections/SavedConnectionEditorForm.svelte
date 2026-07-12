<script>
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import {
    createSavedConnectionEditorWorkspace,
    savedConnectionEditorFormStateStore,
  } from "../../modules/connections.js";
  import {
    CONNECTION_PICKER,
    CONNECTION_VARS,
  } from "../../modules/connectionFields.js";
  import LoadingButton from "../fragments/LoadingButton.svelte";
  import PlainCheckboxField from "../fragments/PlainCheckboxField.svelte";
  import PlainInputField from "../fragments/PlainInputField.svelte";
  import StatusCard from "../fragments/StatusCard.svelte";
  import ConnectionBasicFields from "./ConnectionBasicFields.svelte";
  import ConnectionMetadataFields from "./ConnectionMetadataFields.svelte";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import RadarIcon from "@lucide/svelte/icons/radar";
  import SaveIcon from "@lucide/svelte/icons/save";
  import TagIcon from "@lucide/svelte/icons/tag";

  let { active } = $props();
  const savedConnectionEditorWorkspace = createSavedConnectionEditorWorkspace();
  const {
    applyDetectedProfile,
    basicFieldsDisplayStateStore,
    closeEditor,
    detectProfile,
    editorDisplayStateStore,
    editorDraftStateStore,
    savedConnectionEditorLoadingStateStore,
    metadataFieldsDisplayStateStore,
    onSavedEditorConnectTimeoutSecsInput,
    onSavedEditorDeviceProfileChange,
    onSavedEditorEnablePasswordInput,
    onSavedEditorHostInput,
    onSavedEditorLinuxShellFlavorChange,
    onSavedEditorNameInput,
    onSavedEditorPasswordInput,
    onSavedEditorPortInput,
    onSavedEditorSshSecurityChange,
    onSavedEditorUsernameInput,
    saveConnection,
    setEnabled: setEditorEnabled,
    setEditorContext,
  } = savedConnectionEditorWorkspace;
  let editorFormState = $derived($savedConnectionEditorFormStateStore);
  let editorDraft = $derived($editorDraftStateStore);
  let editorDisplay = $derived($editorDisplayStateStore);
  let editorBasicFieldsDisplay = $derived($basicFieldsDisplayStateStore);
  let metadataFieldsDisplay = $derived($metadataFieldsDisplayStateStore);
  let savedConnectionEditorLoadingState = $derived(
    $savedConnectionEditorLoadingStateStore,
  );
  // Basic field callbacks come from createSavedConnectionEditorWorkspace() via savedConnectionEditorBasicFieldWiring().

  $effect(() => {
    setEditorContext({ active, formState: editorFormState });
  });
</script>

{#snippet ConnectionSectionTitle(Icon, title, hint = "")}
  <div class="flex items-center gap-2">
    <div
      class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
    >
      <Icon class="size-4" aria-hidden="true" />
    </div>
    <h4 class="text-sm font-semibold">{title}</h4>
    {#if hint}
      <span class="text-xs text-muted-foreground">· {hint}</span>
    {/if}
  </div>
{/snippet}

<Card.Root class="flex min-h-0 flex-1 flex-col rounded-none border-0">
  <Card.Header>
    <Card.Title>{editorDraft.name || editorDisplay.fields.name}</Card.Title>
    <Card.Description>
      修改后可执行 profile 探测，决定是否替换已保存的 profile。
    </Card.Description>
  </Card.Header>
  <Card.Content class="min-h-0 flex-1 overflow-y-auto px-7 py-6">
    <div class="flex flex-col gap-6">
      <div class="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <div class="grid min-w-0 gap-1.5">
          <span
            class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {editorDisplay.fields.name}
          </span>
          <PlainInputField
            value={editorDraft.name}
            aria-label={editorDisplay.fields.name}
            placeholderText={editorDisplay.fields.name}
            onValueInput={onSavedEditorNameInput}
          />
        </div>
        <PlainCheckboxField
          class="min-h-10 cursor-pointer justify-end self-end whitespace-nowrap rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground"
          controlKind="switch"
          checked={editorDraft.enabled}
          labelText={editorDisplay.fields.enabled}
          onCheckedChange={setEditorEnabled}
        />
      </div>

      <ConnectionBasicFields
        {active}
        basicFieldsDisplay={editorBasicFieldsDisplay}
        splitSections={true}
        onConnectTimeoutSecsInput={onSavedEditorConnectTimeoutSecsInput}
        onDeviceProfileChange={onSavedEditorDeviceProfileChange}
        onEnablePasswordInput={onSavedEditorEnablePasswordInput}
        onHostInput={onSavedEditorHostInput}
        onLinuxShellFlavorChange={onSavedEditorLinuxShellFlavorChange}
        onPasswordInput={onSavedEditorPasswordInput}
        onPortInput={onSavedEditorPortInput}
        onSshSecurityChange={onSavedEditorSshSecurityChange}
        onUsernameInput={onSavedEditorUsernameInput}
      />

      <section class="flex flex-col gap-3">
        {@render ConnectionSectionTitle(TagIcon, "组织与状态")}
        <ConnectionMetadataFields
          {active}
          groupsPickerKey={CONNECTION_PICKER.savedEditGroups}
          labelsPickerKey={CONNECTION_PICKER.savedEditLabels}
          {metadataFieldsDisplay}
          showVars={false}
          varsKey={CONNECTION_VARS.savedEdit}
        />
      </section>

      <section class="flex flex-col gap-3">
        {@render ConnectionSectionTitle(PlusIcon, "自定义变量")}
        <ConnectionMetadataFields
          {active}
          groupsPickerKey={CONNECTION_PICKER.savedEditGroups}
          labelsPickerKey={CONNECTION_PICKER.savedEditLabels}
          {metadataFieldsDisplay}
          showPickers={false}
          varsKey={CONNECTION_VARS.savedEdit}
        />
      </section>
      {#if editorDisplay.showStatus}
        <StatusCard
          message={editorDisplay.status.text}
          tone={editorDisplay.status.tone}
        />
      {/if}
    </div>
  </Card.Content>
  <Card.Footer
    class="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/30 px-7 py-4"
  >
    <div class="min-w-0 flex-1">
      {#if editorDisplay.detectedProfile}
        <div class="flex min-h-8 min-w-0 items-center gap-2 text-sm">
          <RadarIcon class="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span class="shrink-0 text-muted-foreground">
            {editorDisplay.detectedProfileLabel}
          </span>
          <Badge variant="secondary" class="max-w-full font-mono">
            <span class="truncate">{editorDisplay.detectedProfile}</span>
          </Badge>
        </div>
      {/if}
    </div>
    <div class="flex flex-wrap items-center justify-end gap-2">
      <LoadingButton
        variant="outline"
        size="sm"
        loading={savedConnectionEditorLoadingState.detectProfileLoading}
        onclick={detectProfile}
      >
        <RadarIcon data-icon="inline-start" aria-hidden="true" />
        <span>{editorDisplay.buttons.detectProfile.label}</span>
      </LoadingButton>
      {#if editorDisplay.canApplyDetectedProfile}
        <LoadingButton
          variant="default"
          size="sm"
          loading={savedConnectionEditorLoadingState.applyDetectedProfileLoading}
          onclick={applyDetectedProfile}
        >
          <span>{editorDisplay.buttons.applyDetectedProfile.label}</span>
        </LoadingButton>
      {/if}
      <Button variant="ghost" size="sm" type="button" onclick={closeEditor}>
        {editorDisplay.buttons.cancel.label}
      </Button>
      <LoadingButton
        variant="default"
        size="sm"
        loading={savedConnectionEditorLoadingState.saveLoading}
        onclick={saveConnection}
      >
        <SaveIcon data-icon="inline-start" aria-hidden="true" />
        <span>{editorDisplay.buttons.save.label}</span>
      </LoadingButton>
    </div>
  </Card.Footer>
</Card.Root>

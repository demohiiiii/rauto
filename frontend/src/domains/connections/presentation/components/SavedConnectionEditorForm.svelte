<script lang="ts">
  import { currentLanguageState, t } from "$lib/i18n.js";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button/index.js";
  import {
    createSavedConnectionEditorWorkspace,
    savedConnectionEditorFormStateStore,
  } from "$domains/connections/index.js";
  import {
    CONNECTION_PICKER,
    CONNECTION_VARS,
  } from "$domains/connections/index.js";
  import LoadingButton from "$components/fragments/LoadingButton.svelte";
  import PlainCheckboxField from "$components/fragments/PlainCheckboxField.svelte";
  import PlainInputField from "$components/fragments/PlainInputField.svelte";
  import StatusCard from "$components/fragments/StatusCard.svelte";
  import {
    ConnectionBasicFields,
    ConnectionDetectedFacts,
    ConnectionMetadataFields,
  } from "$domains/connections/presentation/components/fields/index.js";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import CpuIcon from "@lucide/svelte/icons/cpu";
  import PlugIcon from "@lucide/svelte/icons/plug";
  import RadarIcon from "@lucide/svelte/icons/radar";
  import SaveIcon from "@lucide/svelte/icons/save";
  import TagIcon from "@lucide/svelte/icons/tag";

  let { active = false }: { active?: boolean } = $props();
  let i18nCurrentLanguage = $derived($currentLanguageState);
  let i18nLabels = $derived.by(() => {
    i18nCurrentLanguage;
    return {
      sectionOrganization: t("connSectionOrganization"),
      sectionCustomVars: t("connSectionCustomVars"),
    };
  });
  const savedConnectionEditorWorkspace = createSavedConnectionEditorWorkspace();
  const {
    basicFieldsDisplayStateStore,
    closeEditor,
    detectProfile,
    testConnection,
    editorDisplayStateStore,
    editorDraftStateStore,
    savedConnectionEditorLoadingStateStore,
    metadataFieldsDisplayStateStore,
    onSavedEditorConnectTimeoutSecsInput,
    onSavedEditorCredentialChange,
    onSavedEditorDeviceProfileChange,
    onSavedEditorDeviceModelInput,
    onSavedEditorHostInput,
    onSavedEditorLinuxShellFlavorChange,
    onSavedEditorOutputEncodingChange,
    onSavedEditorNameInput,
    onSavedEditorPortInput,
    onSavedEditorSshSecurityChange,
    onSavedEditorSoftwareVersionInput,
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

{#snippet ConnectionSectionTitle(
  Icon: typeof PlusIcon,
  title: string,
  hint = "",
)}
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
    <Card.Description>{editorDisplay.description}</Card.Description>
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
        credentialId={editorDraft.credentialId}
        basicFieldsDisplay={editorBasicFieldsDisplay}
        splitSections={true}
        onConnectTimeoutSecsInput={onSavedEditorConnectTimeoutSecsInput}
        onCredentialChange={onSavedEditorCredentialChange}
        onDeviceProfileChange={onSavedEditorDeviceProfileChange}
        onHostInput={onSavedEditorHostInput}
        onLinuxShellFlavorChange={onSavedEditorLinuxShellFlavorChange}
        onOutputEncodingChange={onSavedEditorOutputEncodingChange}
        onPortInput={onSavedEditorPortInput}
        onSshSecurityChange={onSavedEditorSshSecurityChange}
      />

      <section class="flex flex-col gap-3">
        {@render ConnectionSectionTitle(
          CpuIcon,
          editorDisplay.fields.deviceInfo,
          editorDisplay.fields.deviceInfoHint,
        )}
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div class="grid gap-1.5">
            <span
              class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {editorDisplay.fields.deviceModel}
            </span>
            <PlainInputField
              value={editorDraft.deviceModel}
              aria-label={editorDisplay.fields.deviceModel}
              placeholderText={editorBasicFieldsDisplay.deviceModelInput
                .placeholder}
              onValueInput={onSavedEditorDeviceModelInput}
            />
          </div>
          <div class="grid gap-1.5">
            <span
              class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {editorDisplay.fields.softwareVersion}
            </span>
            <PlainInputField
              value={editorDraft.softwareVersion}
              aria-label={editorDisplay.fields.softwareVersion}
              placeholderText={editorBasicFieldsDisplay.softwareVersionInput
                .placeholder}
              onValueInput={onSavedEditorSoftwareVersionInput}
            />
          </div>
        </div>
      </section>

      <section class="flex flex-col gap-3">
        {@render ConnectionSectionTitle(
          TagIcon,
          i18nLabels.sectionOrganization,
        )}
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
        {@render ConnectionSectionTitle(PlusIcon, i18nLabels.sectionCustomVars)}
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
      <ConnectionDetectedFacts
        detectedModel={editorDisplay.detectedModel}
        detectedModelLabel={editorDisplay.detectedModelLabel}
        detectedProfile={editorDisplay.detectedProfile}
        detectedProfileLabel={editorDisplay.detectedProfileLabel}
        detectedVersion={editorDisplay.detectedVersion}
        detectedVersionLabel={editorDisplay.detectedVersionLabel}
        warning={editorDisplay.warning}
      />
    </div>
    <div class="flex flex-wrap items-center justify-end gap-2">
      <LoadingButton
        variant="outline"
        size="sm"
        loading={savedConnectionEditorLoadingState.testConnectionLoading}
        onclick={testConnection}
      >
        <PlugIcon data-icon="inline-start" aria-hidden="true" />
        <span>{editorDisplay.buttons.testConnection.label}</span>
      </LoadingButton>
      <LoadingButton
        variant="outline"
        size="sm"
        loading={savedConnectionEditorLoadingState.detectProfileLoading}
        onclick={detectProfile}
      >
        <RadarIcon data-icon="inline-start" aria-hidden="true" />
        <span>{editorDisplay.buttons.detectProfile.label}</span>
      </LoadingButton>
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

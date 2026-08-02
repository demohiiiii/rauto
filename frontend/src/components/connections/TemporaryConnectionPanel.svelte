<script>
  import { currentLanguageState, t } from "../../lib/i18n.js";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button/index.js";
  import PlainCheckboxField from "../fragments/PlainCheckboxField.svelte";
  import PlainInputField from "../fragments/PlainInputField.svelte";
  import LoadingButton from "../fragments/LoadingButton.svelte";
  import StatusCard from "../fragments/StatusCard.svelte";
  import ConnectionBasicFields from "./ConnectionBasicFields.svelte";
  import ConnectionDetectedFacts from "./ConnectionDetectedFacts.svelte";
  import ConnectionMetadataFields from "./ConnectionMetadataFields.svelte";
  import CheckIcon from "@lucide/svelte/icons/check";
  import CpuIcon from "@lucide/svelte/icons/cpu";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import PlugIcon from "@lucide/svelte/icons/plug";
  import RadarIcon from "@lucide/svelte/icons/radar";
  import SaveIcon from "@lucide/svelte/icons/save";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import TagIcon from "@lucide/svelte/icons/tag";
  import {
    applyTemporaryConnection,
    createTemporaryConnectionPanelWorkspace,
    refreshActiveTemporaryConnectionTarget,
    temporaryConnectionFormStateStore,
  } from "../../modules/connections/connections.js";
  import {
    CONNECTION_PICKER,
    CONNECTION_VARS,
  } from "../../modules/connections/connectionFieldStoreState.js";
  let { active, onCancel } = $props();
  let i18nCurrentLanguage = $derived($currentLanguageState);
  let i18nLabels = $derived.by(() => {
    i18nCurrentLanguage;
    return {
      sessionOnly: t("tempConnSessionOnly"),
      sessionHint: t("tempConnHint"),
      sectionOrganization: t("connSectionOrganization"),
      disabledHint: t("tempConnDisabledHint"),
      sectionCustomVars: t("connSectionCustomVars"),
      cancel: t("cancel"),
      saveAsConnection: t("tempConnSaveAsConnection"),
    };
  });
  const temporaryConnectionPanelWorkspace =
    createTemporaryConnectionPanelWorkspace();
  const {
    createTemporaryDraft,
    detectProfile,
    testConnection,
    metadataFieldsDisplayStateStore,
    onTemporaryConnectTimeoutSecsInput,
    onTemporaryCredentialChange,
    onTemporaryDeviceProfileChange,
    onTemporaryDeviceModelInput,
    onTemporaryHostInput,
    onTemporaryLinuxShellFlavorChange,
    onTemporaryPortInput,
    onTemporarySshSecurityChange,
    onTemporarySoftwareVersionInput,
    setPanelContext,
    setEnabled: setTemporaryConnectionEnabled,
    temporaryBasicFieldsDisplayStateStore,
    temporaryConnectionLoadingStateStore,
    temporaryDisplayStateStore,
    temporaryDraftStateStore,
  } = temporaryConnectionPanelWorkspace;
  let temporaryConnectionFormState = $derived(
    $temporaryConnectionFormStateStore,
  );
  let temporaryDraft = $derived($temporaryDraftStateStore);
  let temporaryConnectionLoadingState = $derived(
    $temporaryConnectionLoadingStateStore,
  );
  let temporaryDisplay = $derived($temporaryDisplayStateStore);
  let temporaryBasicFieldsDisplay = $derived(
    $temporaryBasicFieldsDisplayStateStore,
  );
  let metadataFieldsDisplay = $derived($metadataFieldsDisplayStateStore);
  // Basic field callbacks come from createTemporaryConnectionPanelWorkspace() via temporaryConnectionBasicFieldWiring().

  $effect(() => {
    setPanelContext({
      active,
      formState: temporaryConnectionFormState,
    });
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

<Card.Root
  class="flex min-h-0 flex-1 flex-col rounded-none border-0"
  hidden={!active}
>
  <Card.Header class="sr-only">
    <Card.Title>{temporaryDisplay.title}</Card.Title>
    <Card.Description>{temporaryDisplay.help}</Card.Description>
  </Card.Header>
  <Card.Content class="min-h-0 flex-1 overflow-y-auto px-7 py-6">
    <div class="mx-auto flex max-w-5xl flex-col gap-6">
      <div
        class="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4"
      >
        <div class="flex items-start gap-3">
          <div
            class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary"
          >
            <SparklesIcon class="size-4" aria-hidden="true" />
          </div>
          <div>
            <p class="text-sm font-semibold">{i18nLabels.sessionOnly}</p>
            <p class="mt-1 text-xs leading-5 text-muted-foreground">
              {i18nLabels.sessionHint}
            </p>
          </div>
        </div>
      </div>

      <ConnectionBasicFields
        {active}
        credentialId={temporaryDraft.credentialId}
        basicFieldsDisplay={temporaryBasicFieldsDisplay}
        splitSections={true}
        onConnectTimeoutSecsInput={onTemporaryConnectTimeoutSecsInput}
        onCredentialChange={onTemporaryCredentialChange}
        onDeviceProfileChange={onTemporaryDeviceProfileChange}
        onHostInput={onTemporaryHostInput}
        onLinuxShellFlavorChange={onTemporaryLinuxShellFlavorChange}
        onPortInput={onTemporaryPortInput}
        onSshSecurityChange={onTemporarySshSecurityChange}
      />

      <section class="flex flex-col gap-3">
        {@render ConnectionSectionTitle(
          CpuIcon,
          temporaryDisplay.fields.deviceInfo,
          temporaryDisplay.fields.deviceInfoHint,
        )}
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div class="grid gap-1.5">
            <span
              class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {temporaryDisplay.fields.deviceModel}
            </span>
            <PlainInputField
              value={temporaryDraft.deviceModel}
              aria-label={temporaryDisplay.fields.deviceModel}
              placeholderText={temporaryBasicFieldsDisplay.deviceModelInput
                .placeholder}
              onValueInput={onTemporaryDeviceModelInput}
            />
          </div>
          <div class="grid gap-1.5">
            <span
              class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {temporaryDisplay.fields.softwareVersion}
            </span>
            <PlainInputField
              value={temporaryDraft.softwareVersion}
              aria-label={temporaryDisplay.fields.softwareVersion}
              placeholderText={temporaryBasicFieldsDisplay.softwareVersionInput
                .placeholder}
              onValueInput={onTemporarySoftwareVersionInput}
            />
          </div>
        </div>
      </section>

      <section class="flex flex-col gap-3">
        {@render ConnectionSectionTitle(
          TagIcon,
          i18nLabels.sectionOrganization,
        )}
        <div
          class="flex min-h-12 flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3"
        >
          <div>
            <p class="text-sm font-medium">{temporaryDisplay.enabledLabel}</p>
            <p class="text-xs text-muted-foreground">
              {i18nLabels.disabledHint}
            </p>
          </div>
          <PlainCheckboxField
            class="cursor-pointer justify-end whitespace-nowrap text-xs font-bold uppercase tracking-wide text-muted-foreground"
            controlKind="switch"
            checked={temporaryDraft.enabled}
            labelText={temporaryDisplay.enabledLabel}
            onCheckedChange={setTemporaryConnectionEnabled}
          />
        </div>
        <ConnectionMetadataFields
          {active}
          groupsPickerKey={CONNECTION_PICKER.savedGroups}
          labelsPickerKey={CONNECTION_PICKER.savedLabels}
          {metadataFieldsDisplay}
          onMetadataChange={refreshActiveTemporaryConnectionTarget}
          showVars={false}
          varsKey={CONNECTION_VARS.saved}
        />
      </section>

      <section class="flex flex-col gap-3">
        {@render ConnectionSectionTitle(PlusIcon, i18nLabels.sectionCustomVars)}
        <ConnectionMetadataFields
          {active}
          groupsPickerKey={CONNECTION_PICKER.savedGroups}
          labelsPickerKey={CONNECTION_PICKER.savedLabels}
          {metadataFieldsDisplay}
          onMetadataChange={refreshActiveTemporaryConnectionTarget}
          showPickers={false}
          varsKey={CONNECTION_VARS.saved}
        />
      </section>

      <p class="text-xs leading-5 text-muted-foreground">
        {temporaryDisplay.hint}
      </p>
      {#if temporaryDisplay.showStatus}
        <StatusCard
          message={temporaryDisplay.status.text}
          tone={temporaryDisplay.status.tone}
        />
      {/if}
    </div>
  </Card.Content>
  <Card.Footer
    class="flex flex-col items-stretch gap-3 border-t border-border bg-muted/30 px-7 py-4 sm:flex-row sm:items-center"
  >
    <div class="min-w-0 flex-1">
      <ConnectionDetectedFacts
        detectedModel={temporaryDisplay.detectedModel}
        detectedModelLabel={temporaryDisplay.detectedModelLabel}
        detectedProfile={temporaryDisplay.detectedProfile}
        detectedProfileLabel={temporaryDisplay.detectedProfileLabel}
        detectedVersion={temporaryDisplay.detectedVersion}
        detectedVersionLabel={temporaryDisplay.detectedVersionLabel}
        warning={temporaryDisplay.warning}
      />
    </div>
    <div class="flex flex-wrap items-center justify-end gap-2">
      <LoadingButton
        variant="outline"
        size="sm"
        loading={temporaryConnectionLoadingState.testConnectionLoading}
        onclick={testConnection}
      >
        <PlugIcon data-icon="inline-start" aria-hidden="true" />
        <span>{temporaryDisplay.buttons.testConnection.label}</span>
      </LoadingButton>
      <LoadingButton
        variant="outline"
        size="sm"
        loading={temporaryConnectionLoadingState.detectProfileLoading}
        onclick={detectProfile}
      >
        <RadarIcon data-icon="inline-start" aria-hidden="true" />
        <span>{temporaryDisplay.buttons.detectProfile.label}</span>
      </LoadingButton>
      <Button variant="ghost" size="sm" type="button" onclick={onCancel}>
        {i18nLabels.cancel}
      </Button>
      <LoadingButton
        variant="outline"
        size="sm"
        loading={temporaryConnectionLoadingState.createDraftLoading}
        onclick={createTemporaryDraft}
      >
        <SaveIcon data-icon="inline-start" aria-hidden="true" />
        {i18nLabels.saveAsConnection}
      </LoadingButton>
      <Button
        variant="default"
        size="sm"
        type="button"
        onclick={applyTemporaryConnection}
      >
        <CheckIcon data-icon="inline-start" aria-hidden="true" />
        {temporaryDisplay.buttons.apply.label}
      </Button>
    </div>
  </Card.Footer>
</Card.Root>

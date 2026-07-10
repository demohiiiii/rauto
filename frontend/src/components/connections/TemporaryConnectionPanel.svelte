<script>
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button/index.js";
  import PlainCheckboxField from "../fragments/PlainCheckboxField.svelte";
  import LoadingButton from "../fragments/LoadingButton.svelte";
  import StatusCard from "../fragments/StatusCard.svelte";
  import ConnectionBasicFields from "./ConnectionBasicFields.svelte";
  import ConnectionMetadataFields from "./ConnectionMetadataFields.svelte";
  import CheckIcon from "@lucide/svelte/icons/check";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SaveIcon from "@lucide/svelte/icons/save";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import TagIcon from "@lucide/svelte/icons/tag";
  import {
    applyTemporaryConnection,
    createTemporaryConnectionPanelWorkspace,
    refreshActiveTemporaryConnectionTarget,
    temporaryConnectionFormStateStore,
  } from "../../modules/connections.js";
  import {
    CONNECTION_PICKER,
    CONNECTION_VARS,
  } from "../../modules/connectionFields.js";
  let { active, connectionTestStatus, onCancel } = $props();
  const temporaryConnectionPanelWorkspace =
    createTemporaryConnectionPanelWorkspace();
  const {
    createTemporaryDraft,
    metadataFieldsDisplayStateStore,
    onTemporaryDeviceProfileChange,
    onTemporaryEnablePasswordInput,
    onTemporaryHostInput,
    onTemporaryLinuxShellFlavorChange,
    onTemporaryPasswordInput,
    onTemporaryPortInput,
    onTemporarySshSecurityChange,
    onTemporaryUsernameInput,
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
      connectionTestStatus,
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
            <p class="text-sm font-semibold">仅当前会话使用</p>
            <p class="mt-1 text-xs leading-5 text-muted-foreground">
              临时目标不会写入已保存连接列表；留空字段将回退到服务启动时的 CLI
              默认参数。
            </p>
          </div>
        </div>
      </div>

      <ConnectionBasicFields
        {active}
        basicFieldsDisplay={temporaryBasicFieldsDisplay}
        splitSections={true}
        onDeviceProfileChange={onTemporaryDeviceProfileChange}
        onEnablePasswordInput={onTemporaryEnablePasswordInput}
        onHostInput={onTemporaryHostInput}
        onLinuxShellFlavorChange={onTemporaryLinuxShellFlavorChange}
        onPasswordInput={onTemporaryPasswordInput}
        onPortInput={onTemporaryPortInput}
        onSshSecurityChange={onTemporarySshSecurityChange}
        onUsernameInput={onTemporaryUsernameInput}
      />

      <section class="flex flex-col gap-3">
        {@render ConnectionSectionTitle(TagIcon, "组织与状态")}
        <div
          class="flex min-h-12 flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3"
        >
          <div>
            <p class="text-sm font-medium">{temporaryDisplay.enabledLabel}</p>
            <p class="text-xs text-muted-foreground">
              关闭后该临时目标不会应用到当前连接上下文。
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
        {@render ConnectionSectionTitle(PlusIcon, "自定义变量")}
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
    class="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/30 px-7 py-4"
  >
    <Button variant="ghost" size="sm" type="button" onclick={onCancel}>
      取消
    </Button>
    <div class="inline-flex items-center gap-2">
      <LoadingButton
        variant="outline"
        size="sm"
        loading={temporaryConnectionLoadingState.createDraftLoading}
        onclick={createTemporaryDraft}
      >
        <SaveIcon data-icon="inline-start" aria-hidden="true" />
        另存为连接
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

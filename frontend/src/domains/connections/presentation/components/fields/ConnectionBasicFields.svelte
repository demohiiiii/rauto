<script lang="ts">
  import { currentLanguageState, t } from "$lib/i18n.js";
  import PlainInputField from "$components/fragments/PlainInputField.svelte";
  import PlainSelectField from "$components/fragments/PlainSelectField.svelte";
  import ConnectionCredentialField from "./ConnectionCredentialField.svelte";
  import {
    createConnectionBasicFieldsWorkspace,
    type connectionBasicFieldsPresentation,
  } from "$domains/connections/index.js";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import TerminalIcon from "@lucide/svelte/icons/terminal";

  type ConnectionBasicFieldsDisplay = ReturnType<
    typeof connectionBasicFieldsPresentation
  >;
  type ConnectionFieldValueHandler = (value: string) => void;

  interface Props {
    active?: boolean;
    basicFieldsDisplay: ConnectionBasicFieldsDisplay;
    credentialId?: string;
    onConnectTimeoutSecsInput?: ConnectionFieldValueHandler;
    onCredentialChange?: ConnectionFieldValueHandler;
    onDeviceProfileChange?: ConnectionFieldValueHandler;
    onHostInput?: ConnectionFieldValueHandler;
    onLinuxShellFlavorChange?: ConnectionFieldValueHandler;
    onOutputEncodingChange?: ConnectionFieldValueHandler;
    onPortInput?: ConnectionFieldValueHandler;
    onSshSecurityChange?: ConnectionFieldValueHandler;
    splitSections?: boolean;
  }

  let {
    active = true,
    basicFieldsDisplay,
    credentialId = "",
    onCredentialChange,
    onConnectTimeoutSecsInput,
    onDeviceProfileChange,
    onHostInput,
    onLinuxShellFlavorChange,
    onOutputEncodingChange,
    onPortInput,
    onSshSecurityChange,
    splitSections = false,
  }: Props = $props();
  let i18nCurrentLanguage = $derived($currentLanguageState);
  let i18nLabels = $derived.by(() => {
    i18nCurrentLanguage;
    return {
      sectionCredentials: t("connSectionCredentials"),
      sectionCredentialsHint: t("connSectionCredentialsHint"),
      sectionPlatform: t("connSectionPlatform"),
    };
  });

  function handleDeviceProfileChange(value: string): void {
    onDeviceProfileChange?.(value);
  }

  function handleConnectTimeoutSecsInput(value: string): void {
    onConnectTimeoutSecsInput?.(value);
  }

  function handleCredentialChange(value: string): void {
    onCredentialChange?.(value);
  }

  function handleHostInput(value: string): void {
    onHostInput?.(value);
  }

  function handleLinuxShellFlavorChange(value: string): void {
    onLinuxShellFlavorChange?.(value);
  }

  function handleOutputEncodingChange(value: string): void {
    onOutputEncodingChange?.(value);
  }

  function handlePortInput(value: string): void {
    onPortInput?.(value);
  }

  function handleSshSecurityChange(value: string): void {
    onSshSecurityChange?.(value);
  }

  let connectionValues = $derived(basicFieldsDisplay.values);
  const connectionBasicFieldsWorkspace = createConnectionBasicFieldsWorkspace({
    onConnectTimeoutSecsInput: handleConnectTimeoutSecsInput,
    onDeviceProfileChange: handleDeviceProfileChange,
    onCredentialChange: handleCredentialChange,
    onHostInput: handleHostInput,
    onLinuxShellFlavorChange: handleLinuxShellFlavorChange,
    onOutputEncodingChange: handleOutputEncodingChange,
    onPortInput: handlePortInput,
    onSshSecurityChange: handleSshSecurityChange,
  });
  const {
    credentialChangeHandler,
    connectTimeoutSecsInputHandler,
    deviceProfileChangeHandler,
    hostInputHandler,
    linuxShellFlavorChangeHandler,
    outputEncodingChangeHandler,
    portInputHandler,
    sshSecurityChangeHandler,
  } = connectionBasicFieldsWorkspace;
</script>

{#snippet sectionTitle(Icon: typeof TerminalIcon, title: string, hint = "")}
  <div class="flex items-center gap-2">
    <div
      class="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
    >
      <Icon class="size-4" aria-hidden="true" />
    </div>
    <h4 class="text-sm font-semibold">{title}</h4>
    {#if hint}
      <span class="text-xs text-muted-foreground">· {hint}</span>
    {/if}
  </div>
{/snippet}

{#snippet fieldLabel(text: string)}
  <span
    class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
  >
    {text}
  </span>
{/snippet}

{#snippet platformFieldLabel(text: string)}
  <span
    class="flex min-h-10 items-end text-[11px] font-semibold uppercase leading-5 tracking-wider text-muted-foreground"
  >
    {text}
  </span>
{/snippet}

{#if splitSections}
  <div class="flex flex-col gap-6">
    <section class="flex flex-col gap-3">
      {@render sectionTitle(
        TerminalIcon,
        i18nLabels.sectionCredentials,
        i18nLabels.sectionCredentialsHint,
      )}
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div class="grid gap-1.5 lg:col-span-2">
          {@render fieldLabel(basicFieldsDisplay.hostInput.placeholder)}
          <PlainInputField
            value={connectionValues.host}
            aria-label={basicFieldsDisplay.hostInput.ariaLabelText}
            placeholderText={basicFieldsDisplay.hostInput.placeholder}
            focus-request-version={active
              ? basicFieldsDisplay.focusHostRequestVersion
              : 0}
            select-on-focus-request={true}
            onValueInput={hostInputHandler()}
          />
        </div>
        <div class="grid gap-1.5">
          {@render fieldLabel(basicFieldsDisplay.portInput.placeholder)}
          <PlainInputField
            value={connectionValues.port}
            aria-label={basicFieldsDisplay.portInput.ariaLabelText}
            placeholderText={basicFieldsDisplay.portInput.placeholder}
            type="text"
            onValueInput={portInputHandler()}
          />
        </div>
        <div class="grid gap-1.5">
          {@render fieldLabel(
            basicFieldsDisplay.connectTimeoutSecsInput.placeholder,
          )}
          <PlainInputField
            value={connectionValues.connectTimeoutSecs}
            aria-label={basicFieldsDisplay.connectTimeoutSecsInput
              .ariaLabelText}
            placeholderText={basicFieldsDisplay.connectTimeoutSecsInput
              .placeholder}
            type="number"
            min="1"
            step="1"
            onValueInput={connectTimeoutSecsInputHandler()}
          />
        </div>
        <ConnectionCredentialField
          value={credentialId}
          onValueChange={credentialChangeHandler()}
        />
      </div>
    </section>

    <section class="flex flex-col gap-3">
      {@render sectionTitle(SparklesIcon, i18nLabels.sectionPlatform)}
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div class="grid min-w-0 gap-1.5">
          {@render platformFieldLabel(
            basicFieldsDisplay.sshSecuritySelect.title,
          )}
          <PlainSelectField
            class="min-w-0 justify-between truncate"
            title={basicFieldsDisplay.sshSecuritySelect.title}
            aria-label={basicFieldsDisplay.sshSecuritySelect.ariaLabelText}
            value={connectionValues.sshSecurity}
            optionRows={basicFieldsDisplay.sshSecuritySelect
              .sshSecurityOptionRows}
            onValueChange={sshSecurityChangeHandler()}
          />
        </div>
        <div class="grid min-w-0 gap-1.5">
          {@render platformFieldLabel(
            basicFieldsDisplay.linuxShellFlavorSelect.title,
          )}
          <PlainSelectField
            class="min-w-0 justify-between truncate"
            title={basicFieldsDisplay.linuxShellFlavorSelect.title}
            aria-label={basicFieldsDisplay.linuxShellFlavorSelect.ariaLabelText}
            value={connectionValues.linuxShellFlavor}
            optionRows={basicFieldsDisplay.linuxShellFlavorSelect
              .linuxShellOptionRows}
            onValueChange={linuxShellFlavorChangeHandler()}
          />
        </div>
        <div class="grid min-w-0 gap-1.5">
          {@render platformFieldLabel(
            basicFieldsDisplay.outputEncodingSelect.title,
          )}
          <PlainSelectField
            class="min-w-0 justify-between truncate"
            title={basicFieldsDisplay.outputEncodingSelect.title}
            aria-label={basicFieldsDisplay.outputEncodingSelect.ariaLabelText}
            value={connectionValues.outputEncoding}
            optionRows={basicFieldsDisplay.outputEncodingSelect
              .outputEncodingOptionRows}
            onValueChange={outputEncodingChangeHandler()}
          />
        </div>
        <div class="grid min-w-0 gap-1.5">
          {@render platformFieldLabel(
            basicFieldsDisplay.deviceProfileSelect.title,
          )}
          <PlainSelectField
            class="min-w-0 justify-between truncate"
            title={basicFieldsDisplay.deviceProfileSelect.title}
            aria-label={basicFieldsDisplay.deviceProfileSelect.ariaLabelText}
            value={connectionValues.deviceProfile}
            optionRows={basicFieldsDisplay.deviceProfileSelect
              .deviceProfileOptionRows}
            onValueChange={deviceProfileChangeHandler()}
          />
        </div>
      </div>
    </section>
  </div>
{:else}
  <div class="grid gap-2 md:grid-cols-2 min-[82rem]:grid-cols-4">
    <PlainInputField
      value={connectionValues.host}
      aria-label={basicFieldsDisplay.hostInput.ariaLabelText}
      placeholderText={basicFieldsDisplay.hostInput.placeholder}
      focus-request-version={active
        ? basicFieldsDisplay.focusHostRequestVersion
        : 0}
      select-on-focus-request={true}
      onValueInput={hostInputHandler()}
    />

    <PlainInputField
      value={connectionValues.port}
      aria-label={basicFieldsDisplay.portInput.ariaLabelText}
      placeholderText={basicFieldsDisplay.portInput.placeholder}
      type="text"
      onValueInput={portInputHandler()}
    />
    <PlainInputField
      value={connectionValues.connectTimeoutSecs}
      aria-label={basicFieldsDisplay.connectTimeoutSecsInput.ariaLabelText}
      placeholderText={basicFieldsDisplay.connectTimeoutSecsInput.placeholder}
      type="number"
      min="1"
      step="1"
      onValueInput={connectTimeoutSecsInputHandler()}
    />
    <ConnectionCredentialField
      value={credentialId}
      onValueChange={credentialChangeHandler()}
    />
    <PlainSelectField
      title={basicFieldsDisplay.sshSecuritySelect.title}
      aria-label={basicFieldsDisplay.sshSecuritySelect.ariaLabelText}
      value={connectionValues.sshSecurity}
      optionRows={basicFieldsDisplay.sshSecuritySelect.sshSecurityOptionRows}
      onValueChange={sshSecurityChangeHandler()}
    />
    <PlainSelectField
      title={basicFieldsDisplay.linuxShellFlavorSelect.title}
      aria-label={basicFieldsDisplay.linuxShellFlavorSelect.ariaLabelText}
      value={connectionValues.linuxShellFlavor}
      optionRows={basicFieldsDisplay.linuxShellFlavorSelect
        .linuxShellOptionRows}
      onValueChange={linuxShellFlavorChangeHandler()}
    />
    <PlainSelectField
      title={basicFieldsDisplay.outputEncodingSelect.title}
      aria-label={basicFieldsDisplay.outputEncodingSelect.ariaLabelText}
      value={connectionValues.outputEncoding}
      optionRows={basicFieldsDisplay.outputEncodingSelect
        .outputEncodingOptionRows}
      onValueChange={outputEncodingChangeHandler()}
    />
    <PlainSelectField
      title={basicFieldsDisplay.deviceProfileSelect.title}
      aria-label={basicFieldsDisplay.deviceProfileSelect.ariaLabelText}
      value={connectionValues.deviceProfile}
      optionRows={basicFieldsDisplay.deviceProfileSelect
        .deviceProfileOptionRows}
      onValueChange={deviceProfileChangeHandler()}
    />
  </div>
{/if}

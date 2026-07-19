<script>
  import PlainInputField from "../fragments/PlainInputField.svelte";
  import PlainSelectField from "../fragments/PlainSelectField.svelte";
  import { createConnectionBasicFieldsWorkspace } from "../../modules/connections/connections.js";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import TerminalIcon from "@lucide/svelte/icons/terminal";

  let {
    active = true,
    basicFieldsDisplay,
    onConnectTimeoutSecsInput,
    onDeviceProfileChange,
    onEnablePasswordInput,
    onHostInput,
    onLinuxShellFlavorChange,
    onPasswordInput,
    onPortInput,
    onSshSecurityChange,
    onUsernameInput,
    splitSections = false,
  } = $props();

  function handleDeviceProfileChange(value) {
    if (typeof onDeviceProfileChange === "function") {
      return onDeviceProfileChange(value);
    }
    return undefined;
  }

  function handleConnectTimeoutSecsInput(value) {
    if (typeof onConnectTimeoutSecsInput === "function") {
      return onConnectTimeoutSecsInput(value);
    }
    return undefined;
  }

  function handleEnablePasswordInput(value) {
    if (typeof onEnablePasswordInput === "function") {
      return onEnablePasswordInput(value);
    }
    return undefined;
  }

  function handleHostInput(value) {
    if (typeof onHostInput === "function") {
      return onHostInput(value);
    }
    return undefined;
  }

  function handleLinuxShellFlavorChange(value) {
    if (typeof onLinuxShellFlavorChange === "function") {
      return onLinuxShellFlavorChange(value);
    }
    return undefined;
  }

  function handlePasswordInput(value) {
    if (typeof onPasswordInput === "function") {
      return onPasswordInput(value);
    }
    return undefined;
  }

  function handlePortInput(value) {
    if (typeof onPortInput === "function") {
      return onPortInput(value);
    }
    return undefined;
  }

  function handleSshSecurityChange(value) {
    if (typeof onSshSecurityChange === "function") {
      return onSshSecurityChange(value);
    }
    return undefined;
  }

  function handleUsernameInput(value) {
    if (typeof onUsernameInput === "function") {
      return onUsernameInput(value);
    }
    return undefined;
  }

  let connectionValues = $derived(basicFieldsDisplay.values);
  const connectionBasicFieldsWorkspace = createConnectionBasicFieldsWorkspace({
    onConnectTimeoutSecsInput: handleConnectTimeoutSecsInput,
    onDeviceProfileChange: handleDeviceProfileChange,
    onEnablePasswordInput: handleEnablePasswordInput,
    onHostInput: handleHostInput,
    onLinuxShellFlavorChange: handleLinuxShellFlavorChange,
    onPasswordInput: handlePasswordInput,
    onPortInput: handlePortInput,
    onSshSecurityChange: handleSshSecurityChange,
    onUsernameInput: handleUsernameInput,
  });
  const {
    connectTimeoutSecsInputHandler,
    deviceProfileChangeHandler,
    enablePasswordInputHandler,
    hostInputHandler,
    linuxShellFlavorChangeHandler,
    passwordInputHandler,
    portInputHandler,
    sshSecurityChangeHandler,
    usernameInputHandler,
  } = connectionBasicFieldsWorkspace;
</script>

{#snippet sectionTitle(Icon, title, hint = "")}
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

{#snippet fieldLabel(text)}
  <span
    class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
  >
    {text}
  </span>
{/snippet}

{#snippet platformFieldLabel(text)}
  <span
    class="flex min-h-10 items-end text-[11px] font-semibold uppercase leading-5 tracking-wider text-muted-foreground"
  >
    {text}
  </span>
{/snippet}

{#if splitSections}
  <div class="flex flex-col gap-6">
    <section class="flex flex-col gap-3">
      {@render sectionTitle(TerminalIcon, "连接凭据", "主机 · 认证")}
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
        <div class="grid gap-1.5">
          {@render fieldLabel(basicFieldsDisplay.usernameInput.placeholder)}
          <PlainInputField
            value={connectionValues.username}
            aria-label={basicFieldsDisplay.usernameInput.ariaLabelText}
            placeholderText={basicFieldsDisplay.usernameInput.placeholder}
            type="text"
            onValueInput={usernameInputHandler()}
          />
        </div>
        <div class="grid gap-1.5 lg:col-span-2">
          {@render fieldLabel(basicFieldsDisplay.passwordInput.placeholder)}
          <PlainInputField
            value={connectionValues.password}
            aria-label={basicFieldsDisplay.passwordInput.ariaLabelText}
            placeholderText={basicFieldsDisplay.passwordInput.placeholder}
            type="password"
            onValueInput={passwordInputHandler()}
          />
        </div>
        <div class="grid gap-1.5 lg:col-span-2">
          {@render fieldLabel(
            basicFieldsDisplay.enablePasswordInput.placeholder,
          )}
          <PlainInputField
            value={connectionValues.enablePassword}
            aria-label={basicFieldsDisplay.enablePasswordInput.ariaLabelText}
            placeholderText={basicFieldsDisplay.enablePasswordInput.placeholder}
            type="password"
            onValueInput={enablePasswordInputHandler()}
          />
        </div>
      </div>
    </section>

    <section class="flex flex-col gap-3">
      {@render sectionTitle(SparklesIcon, "平台与兼容")}
      <div
        class="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))]"
      >
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
      value={connectionValues.username}
      aria-label={basicFieldsDisplay.usernameInput.ariaLabelText}
      placeholderText={basicFieldsDisplay.usernameInput.placeholder}
      type="text"
      onValueInput={usernameInputHandler()}
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
    <PlainInputField
      value={connectionValues.password}
      aria-label={basicFieldsDisplay.passwordInput.ariaLabelText}
      placeholderText={basicFieldsDisplay.passwordInput.placeholder}
      type="password"
      onValueInput={passwordInputHandler()}
    />
    <PlainInputField
      value={connectionValues.enablePassword}
      aria-label={basicFieldsDisplay.enablePasswordInput.ariaLabelText}
      placeholderText={basicFieldsDisplay.enablePasswordInput.placeholder}
      type="password"
      onValueInput={enablePasswordInputHandler()}
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
      title={basicFieldsDisplay.deviceProfileSelect.title}
      aria-label={basicFieldsDisplay.deviceProfileSelect.ariaLabelText}
      value={connectionValues.deviceProfile}
      optionRows={basicFieldsDisplay.deviceProfileSelect
        .deviceProfileOptionRows}
      onValueChange={deviceProfileChangeHandler()}
    />
  </div>
{/if}

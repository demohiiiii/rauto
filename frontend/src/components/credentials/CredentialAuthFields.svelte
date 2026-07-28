<script>
  import * as Select from "$lib/components/ui/select/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { t } from "../../lib/i18n.js";

  let { form, editing = false } = $props();

  const authOptions = $derived([
    { value: "password", label: t("credentialAuthPassword") },
    { value: "private_key", label: t("credentialAuthPrivateKey") },
    {
      value: "private_key_file",
      label: t("credentialAuthPrivateKeyFile"),
    },
    { value: "agent", label: t("credentialAuthAgent") },
  ]);
  const authLabel = $derived(
    authOptions.find((option) => option.value === form.authType)?.label ??
      authOptions[0].label,
  );

  function setAuthType(value) {
    form.authType = value || "password";
    form.password = "";
    form.privateKey = "";
    form.privateKeyPath = "";
    form.passphrase = "";
    form.hasAuthSecret = false;
    form.hasPassphrase = false;
  }
</script>

<label class="grid gap-1.5 sm:col-span-2">
  <span class="text-xs font-semibold text-muted-foreground">
    {t("credentialAuthType")}
  </span>
  <Select.Root type="single" value={form.authType} onValueChange={setAuthType}>
    <Select.Trigger class="w-full">{authLabel}</Select.Trigger>
    <Select.Content>
      <Select.Group>
        {#each authOptions as option (option.value)}
          <Select.Item value={option.value} label={option.label}>
            {option.label}
          </Select.Item>
        {/each}
      </Select.Group>
    </Select.Content>
  </Select.Root>
</label>

{#if form.authType === "password"}
  <label class="grid gap-1.5 sm:col-span-2">
    <span class="text-xs font-semibold text-muted-foreground">
      {t("credentialPassword")}
    </span>
    <Input
      type="password"
      bind:value={form.password}
      autocomplete="new-password"
      placeholder={editing && form.hasAuthSecret ? t("credentialRetained") : ""}
    />
  </label>
{:else if form.authType === "private_key"}
  <label class="grid gap-1.5 sm:col-span-2">
    <span class="text-xs font-semibold text-muted-foreground">
      {t("credentialPrivateKey")}
    </span>
    <Textarea
      class="min-h-36 font-mono text-xs"
      bind:value={form.privateKey}
      autocomplete="off"
      placeholder={editing && form.hasAuthSecret ? t("credentialRetained") : ""}
    />
  </label>
  <label class="grid gap-1.5 sm:col-span-2">
    <span class="text-xs font-semibold text-muted-foreground">
      {t("credentialPassphrase")}
    </span>
    <Input
      type="password"
      bind:value={form.passphrase}
      autocomplete="new-password"
      placeholder={editing && form.hasPassphrase
        ? t("credentialRetained")
        : t("credentialOptional")}
    />
  </label>
{:else if form.authType === "private_key_file"}
  <label class="grid gap-1.5 sm:col-span-2">
    <span class="text-xs font-semibold text-muted-foreground">
      {t("credentialPrivateKeyPath")}
    </span>
    <Input bind:value={form.privateKeyPath} autocomplete="off" />
  </label>
  <label class="grid gap-1.5 sm:col-span-2">
    <span class="text-xs font-semibold text-muted-foreground">
      {t("credentialPassphrase")}
    </span>
    <Input
      type="password"
      bind:value={form.passphrase}
      autocomplete="new-password"
      placeholder={editing && form.hasPassphrase
        ? t("credentialRetained")
        : t("credentialOptional")}
    />
  </label>
{:else if form.authType === "agent"}
  <p class="text-sm text-muted-foreground sm:col-span-2">
    {t("credentialAgentHint")}
  </p>
{/if}

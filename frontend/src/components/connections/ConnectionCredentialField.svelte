<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import { listCredentials } from "../../api/client.js";
  import { credentialErrorMessage } from "../../modules/credentials/credentialState.js";
  import { t } from "../../lib/i18n.js";
  import KeyRoundIcon from "@lucide/svelte/icons/key-round";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import { onMount } from "svelte";
  import CredentialCreateDialog from "../credentials/CredentialCreateDialog.svelte";

  let { value = "", onValueChange } = $props();
  let credentials = $state([]);
  let loading = $state(false);
  let error = $state("");

  async function loadOptions() {
    loading = true;
    error = "";
    try {
      const payload = await listCredentials();
      credentials = Array.isArray(payload) ? payload : [];
    } catch (loadError) {
      error = credentialErrorMessage(loadError, t) || t("credentialLoadFailed");
    } finally {
      loading = false;
    }
  }

  function handleChange(event) {
    onValueChange?.(event.currentTarget.value);
  }

  function handleCreated(row) {
    credentials = [...credentials, row].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    onValueChange?.(row.id);
  }

  onMount(loadOptions);
</script>

<div class="grid gap-1.5 sm:col-span-2 lg:col-span-4">
  <div class="flex items-center justify-between gap-3">
    <span class="text-[11px] font-semibold uppercase text-muted-foreground">
      {t("credentialName")}
    </span>
    <div class="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        title={t("refresh")}
        aria-label={t("refresh")}
        disabled={loading}
        onclick={loadOptions}
      >
        <RefreshCwIcon class={loading ? "size-4 animate-spin" : "size-4"} />
      </Button>
      <CredentialCreateDialog onCreated={handleCreated} />
    </div>
  </div>
  <div class="relative">
    <KeyRoundIcon
      class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      aria-hidden="true"
    />
    <select
      class="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={t("credentialName")}
      {value}
      onchange={handleChange}
    >
      <option value="">{t("credentialRequired")}</option>
      {#each credentials as credential (credential.id)}
        <option value={credential.id}>
          {credential.name} · {credential.username}
        </option>
      {/each}
    </select>
  </div>
  {#if error}
    <p class="text-xs text-destructive">{error}</p>
  {:else if value === ""}
    <p class="text-xs text-amber-600 dark:text-amber-400">
      {t("credentialRequired")}
    </p>
  {/if}
</div>

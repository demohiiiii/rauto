<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import { cn } from "$lib/utils.js";
  import { listCredentials } from "../../api/client.js";
  import { credentialErrorMessage } from "../../modules/credentials/credentialState.js";
  import { t } from "../../lib/i18n.js";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import { onMount } from "svelte";
  import CredentialCreateDialog from "../credentials/CredentialCreateDialog.svelte";
  import PlainSelectField from "../fragments/PlainSelectField.svelte";

  let { value = "", onValueChange } = $props();
  let credentials = $state([]);
  let loading = $state(false);
  let error = $state("");
  let credentialOptionRows = $derived([
    {
      optionLabel: t("credentialRequired"),
      optionValue: "",
    },
    ...credentials.map((credential) => ({
      optionLabel: `${credential.name} · ${credential.username}`,
      optionValue: credential.id,
    })),
  ]);

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

  function handleValueChange(nextValue) {
    onValueChange?.(nextValue);
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
        <RefreshCwIcon class={cn(loading && "animate-spin")} />
      </Button>
      <CredentialCreateDialog onCreated={handleCreated} />
    </div>
  </div>
  <PlainSelectField
    class="min-w-0 justify-between truncate"
    title={t("credentialRequired")}
    aria-label={t("credentialName")}
    {value}
    optionRows={credentialOptionRows}
    disabled={loading}
    onValueChange={handleValueChange}
  />
  {#if error}
    <p class="text-xs text-destructive">{error}</p>
  {:else if value === ""}
    <p class="text-xs text-amber-600 dark:text-amber-400">
      {t("credentialRequired")}
    </p>
  {/if}
</div>

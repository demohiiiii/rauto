<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { cn } from "$lib/utils.js";
  import {
    createCredentialOptionsWorkspace,
    type CredentialRow,
  } from "$domains/credentials/index.js";
  import { t } from "$lib/i18n.js";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import { onMount } from "svelte";
  import CredentialCreateDialog from "$domains/credentials/presentation/components/CredentialCreateDialog.svelte";
  import PlainSelectField from "$components/fragments/PlainSelectField.svelte";

  let {
    value = "",
    onValueChange = undefined,
  }: { value?: string; onValueChange?: (value: string) => void } = $props();
  const workspace = createCredentialOptionsWorkspace();
  const { displayStateStore } = workspace;
  let display = $derived($displayStateStore);
  let credentialOptionRows = $derived(display.credentialOptionRows);
  let error = $derived(display.error);
  let loading = $derived(display.loading);

  function loadOptions(): Promise<void> {
    return workspace.loadOptions();
  }

  function handleValueChange(nextValue: string): void {
    onValueChange?.(nextValue);
  }

  function handleCreated(row: CredentialRow): void {
    workspace.handleCreated(row);
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

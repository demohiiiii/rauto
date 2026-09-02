<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import {
    createCredentialCreateWorkspace,
    type CredentialForm,
    type CredentialRow,
  } from "../../index.js";
  import CredentialAuthFields from "./CredentialAuthFields.svelte";
  import { t } from "$lib/i18n.js";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import type { ComponentProps } from "svelte";

  let {
    onCreated = undefined,
  }: { onCreated?: (row: CredentialRow) => void | Promise<void> } = $props();
  const workspace = createCredentialCreateWorkspace({
    onCreated: (row) => onCreated?.(row),
  });
  const { stateStore } = workspace;
  let dialogState = $derived($stateStore);
  let error = $derived(dialogState.error);
  let form = $derived(dialogState.form);
  let open = $derived(dialogState.open);
  let saving = $derived(dialogState.saving);

  function patchForm(patch: Partial<CredentialForm>): void {
    workspace.patchForm(patch);
  }

  function handleOpenChange(nextOpen: boolean): void {
    workspace.setOpen(nextOpen);
  }

  function setEnableEnabled(checked: boolean): void {
    workspace.setEnableEnabled(checked);
  }

  function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    return workspace.submit();
  }
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
  <Dialog.Trigger>
    {#snippet child({ props }: { props: ComponentProps<typeof Button> })}
      <Button {...props} variant="ghost" size="sm">
        <PlusIcon data-icon="inline-start" aria-hidden="true" />
        {t("credentialNew")}
      </Button>
    {/snippet}
  </Dialog.Trigger>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>{t("credentialNew")}</Dialog.Title>
      <Dialog.Description>
        {t("credentialCreateDialogDescription")}
      </Dialog.Description>
    </Dialog.Header>

    <form class="flex flex-col gap-4" onsubmit={submit} novalidate>
      <label class="flex flex-col gap-1.5">
        <span class="text-sm font-medium">{t("credentialName")}</span>
        <Input
          value={form.name}
          autocomplete="off"
          required
          oninput={(event) => patchForm({ name: event.currentTarget.value })}
        />
      </label>
      <label class="flex flex-col gap-1.5">
        <span class="text-sm font-medium">{t("credentialUsername")}</span>
        <Input
          value={form.username}
          autocomplete="username"
          required
          oninput={(event) =>
            patchForm({ username: event.currentTarget.value })}
        />
      </label>
      <div class="grid gap-4 sm:grid-cols-2">
        <CredentialAuthFields {form} onChange={patchForm} />
      </div>
      <label
        class="flex min-h-11 items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"
      >
        <Checkbox
          checked={form.enableEnabled}
          onCheckedChange={setEnableEnabled}
        />
        <span>{t("credentialEnableEnabled")}</span>
      </label>
      {#if form.enableEnabled}
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium">
            {t("credentialEnablePassword")}
          </span>
          <Input
            type="password"
            value={form.enablePassword}
            oninput={(event) =>
              patchForm({ enablePassword: event.currentTarget.value })}
            autocomplete="new-password"
            placeholder={t("credentialEnableOptional")}
          />
        </label>
      {/if}

      {#if error}
        <p class="text-sm text-destructive" role="alert">{error}</p>
      {/if}

      <Dialog.Footer>
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onclick={() => handleOpenChange(false)}
        >
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={saving}>
          {#if saving}<Spinner data-icon="inline-start" />{/if}
          {t("credentialCreateAction")}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

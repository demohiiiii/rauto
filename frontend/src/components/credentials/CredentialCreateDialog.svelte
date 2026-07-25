<script>
  import * as Dialog from "$lib/components/ui/dialog";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import { createCredential } from "../../api/client.js";
  import { t } from "../../lib/i18n.js";
  import {
    credentialErrorMessage,
    credentialFormValidationMessage,
    credentialRow,
    credentialSavePayload,
  } from "../../modules/credentials/credentialState.js";
  import PlusIcon from "@lucide/svelte/icons/plus";

  let { onCreated } = $props();
  let open = $state(false);
  let saving = $state(false);
  let error = $state("");
  let form = $state(emptyForm());

  function emptyForm() {
    return {
      name: "",
      username: "",
      password: "",
      enablePassword: "",
      enableEnabled: false,
    };
  }

  function handleOpenChange(nextOpen) {
    open = nextOpen;
    if (!nextOpen) {
      form = emptyForm();
      error = "";
    }
  }

  async function submit(event) {
    event.preventDefault();
    const validationMessage = credentialFormValidationMessage(form, {
      translate: t,
    });
    if (validationMessage) {
      error = validationMessage;
      return;
    }
    saving = true;
    error = "";
    try {
      const row = credentialRow(
        await createCredential(credentialSavePayload(form)),
      );
      onCreated?.(row);
      handleOpenChange(false);
    } catch (submitError) {
      error =
        credentialErrorMessage(submitError, t) || t("credentialCreateFailed");
    } finally {
      saving = false;
    }
  }
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
  <Dialog.Trigger>
    {#snippet child({ props })}
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
        <Input bind:value={form.name} autocomplete="off" required />
      </label>
      <label class="flex flex-col gap-1.5">
        <span class="text-sm font-medium">{t("credentialUsername")}</span>
        <Input bind:value={form.username} autocomplete="username" required />
      </label>
      <label class="flex flex-col gap-1.5">
        <span class="text-sm font-medium">{t("credentialPassword")}</span>
        <Input
          type="password"
          bind:value={form.password}
          autocomplete="new-password"
          required
        />
      </label>
      <label
        class="flex min-h-11 items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"
      >
        <Checkbox bind:checked={form.enableEnabled} />
        <span>{t("credentialEnableEnabled")}</span>
      </label>
      <label class="flex flex-col gap-1.5">
        <span class="text-sm font-medium">{t("credentialEnablePassword")}</span>
        <Input
          type="password"
          bind:value={form.enablePassword}
          autocomplete="new-password"
          placeholder={form.enableEnabled ? t("credentialEnableOptional") : ""}
          disabled={!form.enableEnabled}
        />
      </label>

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

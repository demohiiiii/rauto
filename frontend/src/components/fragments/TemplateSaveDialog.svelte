<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import PlainInputField from "./PlainInputField.svelte";
  import LoadingButton from "./LoadingButton.svelte";
  import { currentLanguageState, t } from "$lib/i18n.js";
  interface Props {
    open: boolean;
    value: string;
    error?: string;
    busy?: boolean;
    onChange: (value: string) => void;
    onClose: () => void;
    onSave: () => unknown;
  }
  let {
    open,
    value,
    error = "",
    busy = false,
    onChange,
    onClose,
    onSave,
  }: Props = $props();
  let labels = $derived.by(() => {
    $currentLanguageState;
    return {
      title: t("templateSourceSaveTitle"),
      hint: t("interactiveNameDialogDescription"),
      name: t("templateSourceName"),
      cancel: t("cancel"),
      save: t("interactiveTemplateSaveBtn"),
      required: t("interactiveTemplateSaveNameRequired"),
    };
  });
</script>

<Dialog.Root
  {open}
  onOpenChange={(next) => {
    if (!next && !busy) onClose();
  }}
>
  <Dialog.Content>
    <Dialog.Header
      ><Dialog.Title>{labels.title}</Dialog.Title><Dialog.Description
        >{labels.hint}</Dialog.Description
      ></Dialog.Header
    >
    <PlainInputField
      {value}
      disabled={busy}
      aria-label={labels.name}
      placeholderText={labels.name}
      focus-request-version={open ? 1 : 0}
      select-on-focus-request={true}
      onValueInput={onChange}
      onKeydown={(event) => {
        if (event.key === "Enter" && !event.isComposing && !busy) {
          event.preventDefault();
          void onSave();
        }
      }}
    />
    {#if error}<p class="text-sm text-destructive" role="alert">
        {error === "name_required" ? labels.required : error}
      </p>{/if}
    <Dialog.Footer
      ><Button variant="outline" disabled={busy} onclick={onClose}
        >{labels.cancel}</Button
      ><LoadingButton loading={busy} disabled={busy} onclick={onSave}
        >{labels.save}</LoadingButton
      ></Dialog.Footer
    >
  </Dialog.Content>
</Dialog.Root>

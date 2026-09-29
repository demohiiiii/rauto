<script lang="ts">
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import CopyPlusIcon from "@lucide/svelte/icons/copy-plus";
  import SaveIcon from "@lucide/svelte/icons/save";
  import Undo2Icon from "@lucide/svelte/icons/undo-2";
  import { Button } from "$lib/components/ui/button/index.js";
  import LoadingButton from "./LoadingButton.svelte";
  import { currentLanguageState, t } from "$lib/i18n.js";
  interface Props {
    readonly: boolean;
    editing: boolean;
    builtin?: boolean;
    busy?: boolean;
    saving?: boolean;
    canSave?: boolean;
    onEdit: () => void;
    onCopy: () => void;
    onSave: () => unknown;
    onCancel: () => unknown;
  }
  let {
    readonly,
    editing,
    builtin = false,
    busy = false,
    saving = false,
    canSave = true,
    onEdit,
    onCopy,
    onSave,
    onCancel,
  }: Props = $props();
  let labels = $derived.by(() => {
    $currentLanguageState;
    return {
      edit: t("interactiveSourceEdit"),
      copy: t("interactiveSourceCopy"),
      save: t("interactiveTemplateSaveBtn"),
      cancel: t("interactiveSourceCancelEdit"),
    };
  });
</script>

{#if readonly}
  {#if !builtin}
    <Button variant="outline" size="sm" disabled={busy} onclick={onEdit}
      ><PencilIcon data-icon="inline-start" />{labels.edit}</Button
    >
  {/if}
  <Button variant="outline" size="sm" disabled={busy} onclick={onCopy}
    ><CopyPlusIcon data-icon="inline-start" />{labels.copy}</Button
  >
{:else}
  <LoadingButton
    variant="outline"
    size="sm"
    loading={saving}
    disabled={busy || !canSave}
    onclick={onSave}
    ><SaveIcon data-icon="inline-start" />{labels.save}</LoadingButton
  >
  {#if editing}<Button
      variant="ghost"
      size="sm"
      disabled={busy}
      onclick={onCancel}
      ><Undo2Icon data-icon="inline-start" />{labels.cancel}</Button
    >{/if}
{/if}

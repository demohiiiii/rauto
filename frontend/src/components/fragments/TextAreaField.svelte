<script lang="ts">
  import type { HTMLTextareaAttributes } from "svelte/elements";
  import PlainTextAreaField from "./PlainTextAreaField.svelte";
  import JsonTextEditor from "./JsonTextEditor.svelte";

  interface Props {
    active?: boolean;
    "aria-label"?: string;
    class?: string;
    disabled?: boolean;
    editorKind?: "json" | "plain";
    hintText?: string;
    labelText?: string;
    onChange?: (value: string) => void;
    onInput?: HTMLTextareaAttributes["oninput"];
    onValueInput?: (value: string) => void;
    placeholderText?: string;
    showLabel?: boolean;
    value?: string;
  }

  let {
    active = true,
    "aria-label": ariaLabel = "",
    disabled = false,
    editorKind = "plain",
    hintText = "",
    labelText = "",
    class: fieldClass = "",
    placeholderText = "",
    showLabel = true,
    value = "",
    onChange,
    onInput,
    onValueInput,
  }: Props = $props();
</script>

<label class="flex flex-col gap-2">
  {#if showLabel}
    <span class="text-sm font-medium text-foreground">{labelText}</span>
  {/if}
  {#if editorKind === "json"}
    <JsonTextEditor
      {active}
      class={fieldClass}
      aria-label={ariaLabel || labelText || placeholderText}
      placeholder={placeholderText}
      {value}
      {onChange}
    />
  {:else}
    <PlainTextAreaField
      class={fieldClass}
      aria-label={ariaLabel || labelText || placeholderText}
      {placeholderText}
      {value}
      {disabled}
      {onInput}
      {onValueInput}
    />
  {/if}
  {#if hintText}
    <div class="text-xs text-slate-500">
      {hintText}
    </div>
  {/if}
</label>

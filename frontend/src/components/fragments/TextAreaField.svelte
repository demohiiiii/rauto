<script>
  import PlainTextAreaField from "./PlainTextAreaField.svelte";
  import JsonTextEditor from "./JsonTextEditor.svelte";

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
  } = $props();
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
    />
  {/if}
  {#if hintText}
    <div class="text-xs text-slate-500">
      {hintText}
    </div>
  {/if}
</label>

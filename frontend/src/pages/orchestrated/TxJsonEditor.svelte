<script>
  import JsonTextEditor from "../../components/fragments/JsonTextEditor.svelte";
  import { createTxJsonEditorWorkspace } from "../../modules/transactionsWorkspace.js";

  let {
    "aria-label": ariaLabel,
    active = true,
    editorKey,
    "host-class": hostClass,
    onInput,
    placeholder,
    value,
  } = $props();
  let editorWorkspace = $derived(
    createTxJsonEditorWorkspace({
      editorKey,
      onInput,
    }),
  );
  let editorTextStore = $derived(editorWorkspace.editorTextStore);
  let editorThemeStore = $derived(editorWorkspace.editorThemeStore);
  let editorText = $derived($editorTextStore);
  let editorTheme = $derived($editorThemeStore);

  $effect(() => {
    if (!active) return;
    return editorWorkspace.connectHost();
  });

  $effect(() => {
    editorWorkspace.setEditorContext({
      editorKey,
      onInput,
      value,
    });
  });
</script>

<JsonTextEditor
  {active}
  class={hostClass}
  aria-label={ariaLabel}
  {placeholder}
  theme={editorTheme}
  value={editorText}
  onChange={editorWorkspace.handleChange}
/>

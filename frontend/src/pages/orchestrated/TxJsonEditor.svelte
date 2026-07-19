<script>
  import { untrack } from "svelte";
  import JsonTextEditor from "../../components/fragments/JsonTextEditor.svelte";
  import { createTxJsonEditorWorkspace } from "../../modules/transactions/transactionPanelState.js";

  let {
    "aria-label": ariaLabel,
    active = true,
    editorKey,
    "host-class": hostClass,
    onInput,
    placeholder,
    value,
  } = $props();
  const initialEditorContext = untrack(() => ({
    editorKey,
    onInput,
    value,
  }));
  const editorWorkspace = createTxJsonEditorWorkspace(initialEditorContext);
  const editorTextStore = editorWorkspace.editorTextStore;
  const editorThemeStore = editorWorkspace.editorThemeStore;
  let editorText = $derived($editorTextStore);
  let editorTheme = $derived($editorThemeStore);
  let connectedValue = initialEditorContext.value;

  $effect(() => {
    if (!active) return;
    const connectionValue = untrack(() => value);
    connectedValue = connectionValue;
    editorWorkspace.setEditorContext({
      editorKey,
      onInput,
      value: connectionValue,
    });
    return editorWorkspace.connectHost();
  });

  $effect(() => {
    if (value === connectedValue) return;
    connectedValue = value;
    editorWorkspace.setEditorContext({ value });
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

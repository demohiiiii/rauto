<script>
  import { getContext, untrack } from "svelte";
  import { readable } from "svelte/store";
  import CodeMirror from "svelte-codemirror-editor";
  import { json } from "@codemirror/lang-json";
  import { Skeleton } from "$lib/components/ui/skeleton/index.js";
  import { jsonTextEditorBindings } from "../../lib/events.js";
  import { dashboardThemeContextKey } from "../../lib/svelte.js";
  import { classNames } from "../../lib/ui.js";

  let {
    active = true,
    class: cssClass = "",
    "aria-label": ariaLabel,
    compact = false,
    fill = false,
    hidden = false,
    immediate = false,
    onChange,
    placeholder,
    theme = "",
    value = "",
  } = $props();

  const jsonLanguage = json();
  const dashboardThemeState =
    getContext(dashboardThemeContextKey) ||
    readable({
      currentTheme: "dark",
    });
  let editorTheme = $derived(
    theme === "light" || theme === "dark"
      ? theme
      : $dashboardThemeState.currentTheme === "light"
        ? "light"
        : "dark",
  );
  let editorText = $state(untrack(() => (value == null ? "" : String(value))));
  let editorBindings = $derived(
    jsonTextEditorBindings({
      onChange,
      onSetText: (nextText) => {
        editorText = nextText;
      },
    }),
  );
  let compactEditor = $derived(
    compact || /\btx-json-editor-compact\b/.test(cssClass || ""),
  );
  let hostClass = $derived(classNames(cssClass));
  let editorStyles = $derived(
    editorTheme === "light"
      ? {
          "&": {
            height: compactEditor ? "12rem" : "100%",
            minHeight: compactEditor ? "12rem" : "18rem",
          },
          ".cm-editor": { height: "100%" },
          ".cm-scroller": {
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
          },
        }
      : {
          "&": {
            backgroundColor: "#020617",
            color: "#e2e8f0",
            height: compactEditor ? "12rem" : "100%",
            minHeight: compactEditor ? "12rem" : "18rem",
          },
          ".cm-editor": { backgroundColor: "#020617", height: "100%" },
          ".cm-gutters": {
            backgroundColor: "#0f172a",
            borderRightColor: "#1e293b",
            color: "#64748b",
          },
          ".cm-activeLine": { backgroundColor: "#0f172a" },
          ".cm-activeLineGutter": { backgroundColor: "#1e293b" },
          ".cm-content": {
            caretColor: "#f8fafc",
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
          },
          ".cm-scroller": {
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
          },
        },
  );

  $effect(() => {
    const nextText = editorBindings.nextText(editorText, value);
    if (nextText !== null) {
      editorText = nextText;
    }
  });
</script>

<div
  class={hostClass}
  class:tx-json-editor={true}
  class:tx-json-editor-compact={compactEditor}
  class:tx-json-editor-fill={fill}
  class:tx-code-editor-light={editorTheme === "light"}
  class:tx-code-editor-dark={editorTheme !== "light"}
  aria-label={ariaLabel}
  {hidden}
  title={placeholder}
>
  {#if active}
    {#key editorTheme}
      <CodeMirror
        value={editorText}
        lang={jsonLanguage}
        lineWrapping={true}
        nodebounce={immediate}
        {placeholder}
        styles={editorStyles}
        tabSize={2}
        onchange={editorBindings.changeHandler()}
      />
    {/key}
  {:else}
    <div class="grid h-full gap-3 p-3">
      <Skeleton class="h-8 w-40" />
      <Skeleton class="min-h-0 flex-1" />
    </div>
  {/if}
</div>

<style>
  .tx-json-editor {
    width: 100%;
    min-height: 20rem;
    height: clamp(20rem, 52vh, 42rem);
    border: 1px solid color-mix(in oklab, var(--border) 78%, transparent);
    border-radius: 0.82rem;
    overflow: hidden;
    background: color-mix(in oklab, var(--background) 96%, black 4%);
    box-shadow: inset 0 1px 0 color-mix(in oklab, white 4%, transparent);
  }

  .tx-json-editor-compact {
    min-height: 14rem;
    height: clamp(14rem, 36vh, 24rem);
  }

  .tx-json-editor-fill {
    min-height: 0;
    height: 100%;
    max-height: none;
  }

  .tx-code-editor-light {
    border-color: color-mix(in oklab, var(--border) 86%, transparent);
    background: color-mix(in oklab, var(--card) 98%, white 2%);
    box-shadow: inset 0 1px 0 color-mix(in oklab, white 88%, transparent);
  }

  .tx-json-editor :global(.cm-editor),
  .tx-json-editor :global(.cm-scroller) {
    height: 100%;
    min-height: inherit;
    font-family:
      ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
    line-height: 1.45;
  }

  .tx-json-editor :global(.codemirror-wrapper) {
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }
</style>

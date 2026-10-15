<script lang="ts">
  import { createTxDirectVarsPanelWorkspace } from "$domains/transactions/index.js";
  import BracesIcon from "@lucide/svelte/icons/braces";
  import SlidersHorizontalIcon from "@lucide/svelte/icons/sliders-horizontal";
  import Code2Icon from "@lucide/svelte/icons/code-2";
  import { Button } from "$lib/components/ui/button/index.js";
  import { currentLanguageState, t } from "$lib/i18n.js";
  import TxVariablesJsonEditor from "./TxVariablesJsonEditor.svelte";
  import TxVariablesForm from "./TxVariablesForm.svelte";

  interface Props {
    active?: boolean;
    "aria-label"?: string;
    hintKey?: string;
    placeholderFallback?: string;
    placeholderKey?: string;
    prefix: string;
    varsKey: string;
  }

  let {
    active = false,
    "aria-label": ariaLabel = "",
    hintKey = "",
    placeholderFallback = "",
    placeholderKey = "",
    prefix,
    varsKey,
  }: Props = $props();

  const txDirectVarsPanelWorkspace = createTxDirectVarsPanelWorkspace({
    getPanelConfig: () => ({
      ariaLabel,
      hintKey,
      placeholderFallback,
      placeholderKey,
      varsKey,
    }),
  });
  const { changeVarsText, panelDisplayStateStore } = txDirectVarsPanelWorkspace;
  let editorDisplayMode = $state<"form" | "json">("form");
  let panelDisplay = $derived($panelDisplayStateStore);

  $effect(() => {
    if (panelDisplay.formError) editorDisplayMode = "json";
  });

  function label(key: string): string {
    $currentLanguageState;
    return t(key);
  }
</script>

<section
  class="min-w-0 overflow-hidden rounded-xl border border-border/80 bg-background"
  aria-label={ariaLabel || label("txVarsFormTitle")}
  data-runtime-vars
>
  <div
    class="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-muted/15 px-3 py-2"
  >
    <div class="flex items-center gap-2 text-xs font-semibold">
      <BracesIcon class="size-3.5 text-primary" />
      {label("txVarsFormTitle")}
    </div>
    <div
      class="flex items-center gap-0.5 rounded-lg border border-border/50 bg-muted/40 p-0.5"
      role="group"
      aria-label={label("txVarsEditorView")}
    >
      <Button
        variant="ghost"
        size="xs"
        class={editorDisplayMode === "form"
          ? "bg-background text-primary shadow-xs hover:bg-background hover:text-primary"
          : "text-muted-foreground"}
        aria-pressed={editorDisplayMode === "form"}
        disabled={!!panelDisplay.formError}
        title={panelDisplay.formError || undefined}
        onclick={() => {
          editorDisplayMode = "form";
        }}
        ><SlidersHorizontalIcon class="size-3" />{label(
          "txVarsFormView",
        )}</Button
      >
      <Button
        variant="ghost"
        size="xs"
        class={editorDisplayMode === "json"
          ? "bg-background text-primary shadow-xs hover:bg-background hover:text-primary"
          : "text-muted-foreground"}
        aria-pressed={editorDisplayMode === "json"}
        onclick={() => {
          editorDisplayMode = "json";
        }}><Code2Icon class="size-3" />{label("txBlockEditorJsonTab")}</Button
      >
    </div>
  </div>
  {#if editorDisplayMode === "form"}
    <TxVariablesForm {active} {prefix} />
  {:else}
    <div class="grid min-w-0 gap-2 p-3">
      <div class="h-72 min-w-0">
        <TxVariablesJsonEditor
          {active}
          fill
          compact
          error={panelDisplay.formError}
          aria-label={ariaLabel || label("txVarsFormTitle")}
          value={panelDisplay.varsText}
          placeholder={panelDisplay.placeholderText}
          onChange={changeVarsText}
        />
      </div>
      {#if !panelDisplay.formError && panelDisplay.showHint}
        <p class="text-[11px] leading-5 text-muted-foreground">
          {panelDisplay.hintText}
        </p>
      {/if}
    </div>
  {/if}
</section>

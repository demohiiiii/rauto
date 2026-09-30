<script lang="ts">
  import { getContext, type Snippet } from "svelte";
  import PencilLineIcon from "@lucide/svelte/icons/pencil-line";
  import FilesIcon from "@lucide/svelte/icons/files";
  import { currentLanguageState, t } from "$lib/i18n.js";
  import { readonlyFieldsContextKey } from "$lib/svelte.js";

  interface Props {
    value: "manual" | "template";
    disabled?: boolean;
    onValueChange?: (value: "manual" | "template") => void;
    templateTrigger?: Snippet<[string, boolean, Snippet]>;
  }

  let {
    value,
    disabled = false,
    onValueChange,
    templateTrigger,
  }: Props = $props();
  const parentReadonly = getContext<(() => boolean) | undefined>(
    readonlyFieldsContextKey,
  );
  let locked = $derived(disabled || !!parentReadonly?.());
  let labels = $derived.by(() => {
    $currentLanguageState;
    return {
      manual: t("commandSourceManual"),
      template: t("templateSourceTemplate"),
    };
  });
  let templateClass = $derived(
    `input-source-mode${value === "template" ? " input-source-mode-selected" : ""}`,
  );
</script>

{#snippet templateLabel()}
  <FilesIcon class="size-4" aria-hidden="true" /><span>{labels.template}</span>
{/snippet}

<div class="input-source-toggle">
  <span
    class="input-source-slider"
    class:input-source-slider-template={value === "template"}
    aria-hidden="true"
  ></span>
  <button
    type="button"
    class="input-source-mode"
    class:input-source-mode-selected={value === "manual"}
    aria-pressed={value === "manual"}
    disabled={locked}
    onclick={() => {
      if (value !== "manual") onValueChange?.("manual");
    }}
  >
    <PencilLineIcon class="size-4" aria-hidden="true" /><span
      >{labels.manual}</span
    >
  </button>
  {#if templateTrigger}
    {@render templateTrigger(templateClass, locked, templateLabel)}
  {:else}
    <button
      type="button"
      class={templateClass}
      aria-pressed={value === "template"}
      disabled={locked}
      onclick={() => {
        if (value !== "template") onValueChange?.("template");
      }}
    >
      {@render templateLabel()}
    </button>
  {/if}
</div>

<style>
  .input-source-toggle {
    position: relative;
    isolation: isolate;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    padding: 0.1875rem;
    border-radius: 0.625rem;
    background: var(--muted);
    box-shadow: inset 0 0 0 1px
      color-mix(in oklab, var(--border) 55%, transparent);
  }
  .input-source-slider {
    position: absolute;
    z-index: -1;
    inset: 0.1875rem auto 0.1875rem 0.1875rem;
    width: calc((100% - 0.375rem) / 2);
    border-radius: 0.4375rem;
    background: var(--primary);
    box-shadow: 0 2px 4px #00000014;
    transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  .input-source-slider-template {
    transform: translateX(100%);
  }
  .input-source-toggle :global(.input-source-mode) {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    height: 2.125rem;
    padding: 0 0.75rem;
    white-space: nowrap;
    border-radius: 0.4375rem;
    background: transparent;
    color: var(--muted-foreground);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: color 200ms;
  }
  .input-source-toggle :global(.input-source-mode-selected) {
    color: var(--primary-foreground);
  }
  .input-source-toggle
    :global(.input-source-mode:not(.input-source-mode-selected):hover) {
    color: var(--foreground);
  }

  .input-source-toggle :global(button:disabled) {
    cursor: not-allowed;
  }
  .input-source-toggle :global(button:focus-visible) {
    outline: 2px solid var(--ring);
    outline-offset: 3px;
  }
  @media (prefers-reduced-motion: reduce) {
    .input-source-slider,
    .input-source-toggle :global(.input-source-mode) {
      transition: none;
    }
  }
</style>

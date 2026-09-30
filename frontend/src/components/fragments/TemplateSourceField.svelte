<script lang="ts">
  import { tick, type Snippet } from "svelte";
  import ArrowUpRightIcon from "@lucide/svelte/icons/arrow-up-right";
  import CornerDownLeftIcon from "@lucide/svelte/icons/corner-down-left";
  import ArrowDownUpIcon from "@lucide/svelte/icons/arrow-down-up";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Combobox } from "bits-ui";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import InputSourceToggle from "./InputSourceToggle.svelte";
  import FilesIcon from "@lucide/svelte/icons/files";
  import FileTextIcon from "@lucide/svelte/icons/file-text";
  import SearchIcon from "@lucide/svelte/icons/search";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import CheckIcon from "@lucide/svelte/icons/check";
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
  import { currentLanguageState, t } from "$lib/i18n.js";

  interface Props {
    actions?: Snippet;
    value?: string;
    manualValue?: string;
    optionValues?: readonly string[];
    optionDetails?: Record<string, { label: string; badge?: string }>;
    disabled?: boolean;
    showLabel?: boolean;
    labelText?: string;
    hintText?: string;
    onValueChange?: (value: string) => void | boolean | Promise<void | boolean>;
  }
  let {
    actions,
    value = "",
    manualValue = "",
    optionValues = [],
    optionDetails = {},
    disabled = false,
    showLabel = true,
    labelText = "",
    hintText = "",
    onValueChange,
  }: Props = $props();
  const id = $props.id();
  let labels = $derived.by(() => {
    $currentLanguageState;
    return {
      source: t("templateSourceLabel"),
      draft: t("templateSourceDraft"),
      start: t("templateSourceStart"),
      move: t("connectionPickerMove"),
      select: t("connectionPickerSelect"),
      choose: t("templateSourceChoose"),
      search: t("templateSourceSearch"),
      browse: t("templateSourceBrowse"),
      saved: t("templateSourceSaved"),
      empty: t("templateSourceEmpty"),
      noMatch: t("templateSourceNoMatch"),
    };
  });
  let shell = $state<HTMLDivElement | null>(null);
  let searchInput = $state<HTMLInputElement | null>(null);
  let templateTriggerRef = $state<HTMLButtonElement | null>(null);
  let open = $state(false);
  let query = $state("");
  let pending = $state(false);
  let error = $state("");
  let manual = $derived(value === manualValue || !value);
  let selectedTemplate = $derived(manual ? "" : value);
  let selectedDetail = $derived(
    Object.hasOwn(optionDetails, selectedTemplate)
      ? optionDetails[selectedTemplate]
      : { label: selectedTemplate, badge: undefined },
  );
  let selectedLabel = $derived(
    [selectedDetail.badge, selectedDetail.label].filter(Boolean).join(" "),
  );
  let busy = $derived(disabled || pending);
  let options = $derived(
    [...new Set(optionValues)]
      .filter((name) => name && name !== manualValue)
      .map((value) => ({
        value,
        label: optionDetails[value]?.label ?? value,
        badge: optionDetails[value]?.badge,
      })),
  );
  let filtered = $derived(
    options.filter((option) =>
      [option.label, option.badge, option.value]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
    ),
  );

  function setOpen(next: boolean) {
    if (next && busy) return;
    open = next;
    query = "";
    if (next)
      void tick().then(() => {
        if (open) searchInput?.focus();
      });
  }
  function restoreTriggerFocus() {
    void tick().then(() => {
      if (
        !open &&
        templateTriggerRef?.isConnected &&
        (document.activeElement === document.body || !document.activeElement)
      )
        templateTriggerRef.focus();
    });
  }
  async function selectSource(next: string) {
    if (busy || next === value) {
      setOpen(false);
      return;
    }
    pending = true;
    error = "";
    setOpen(false);
    try {
      await onValueChange?.(next);
    } catch (reason) {
      error = reason instanceof Error ? reason.message : t("requestFailed");
    } finally {
      pending = false;
      query = "";
      restoreTriggerFocus();
    }
  }
</script>

<div
  data-template-source
  role="group"
  aria-label={labelText || labels.source}
  class="source-field"
  aria-busy={pending}
>
  {#if showLabel}<span class="source-label">{labelText || labels.source}</span
    >{/if}
  <Popover.Root {open} onOpenChange={setOpen}>
    <Combobox.Root
      type="single"
      bind:value={
        () => selectedTemplate,
        (next) => {
          if (next) void selectSource(next);
        }
      }
      inputValue={query}
      {open}
      onOpenChange={setOpen}
      disabled={busy}
      loop
    >
      <div bind:this={shell} class="source-bar" class:source-disabled={busy}>
        <InputSourceToggle
          value={manual ? "manual" : "template"}
          disabled={busy}
          onValueChange={() => void selectSource(manualValue)}
        >
          {#snippet templateTrigger(className, locked, children)}
            <Popover.Trigger
              bind:ref={templateTriggerRef}
              disabled={locked}
              aria-pressed={!manual}
              class={className}
              aria-label={labels.choose}
            >
              {@render children()}
            </Popover.Trigger>
          {/snippet}
        </InputSourceToggle>
        <div class="source-summary">
          {#if manual}
            <div class="source-draft">
              <span class="source-status-dot" aria-hidden="true"></span>
              <span>{labels.draft}</span>
            </div>
            <button
              class="source-start"
              type="button"
              disabled={busy}
              onclick={() => setOpen(true)}
            >
              {labels.start}<ArrowUpRightIcon
                class="size-3.5"
                aria-hidden="true"
              />
            </button>
          {:else}
            <button
              class="source-document"
              type="button"
              disabled={busy}
              onclick={() => setOpen(true)}
              aria-label={`${labels.browse}: ${selectedLabel}`}
            >
              <span class="source-document-icon" aria-hidden="true"
                ><FileTextIcon class="size-4" /></span
              >
              {#if selectedDetail.badge}
                <Badge
                  variant="secondary"
                  class="shrink-0 border-primary/15 bg-primary/10 px-1.5 py-0 text-[10px] text-primary"
                  >{selectedDetail.badge}</Badge
                >
              {/if}
              <span class="source-document-name" title={selectedDetail.label}
                >{selectedDetail.label}</span
              >
              <span class="source-document-check" aria-hidden="true"
                ><CheckIcon class="size-3" /></span
              >
              <ChevronDownIcon
                class={[
                  "size-3.5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
                  open && "rotate-180",
                ]}
                aria-hidden="true"
              />
            </button>
          {/if}
          {#if pending}<LoaderCircleIcon
              class="size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none"
              aria-label={t("loading")}
            />{/if}
          {#if actions}
            <div class="flex shrink-0 items-center gap-1.5">
              {@render actions()}
            </div>
          {/if}
        </div>
      </div>
      <Popover.Content
        customAnchor={shell}
        sideOffset={10}
        align="end"
        collisionPadding={12}
        class="source-library"
      >
        <div class="source-search">
          <SearchIcon
            class="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <Combobox.Input
            bind:ref={searchInput}
            class="min-w-0 flex-1 bg-transparent py-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            aria-label={labels.search}
            placeholder={labels.search}
            autocomplete="off"
            spellcheck={false}
            oninput={(event) => (query = event.currentTarget.value)}
          />
          <kbd class="source-key" aria-hidden="true">esc</kbd>
        </div>
        <div class="source-library-heading">
          <span>{labels.saved}</span><span class="source-count"
            >{filtered.length}</span
          >
        </div>
        <Combobox.ContentStatic class="outline-none">
          <Combobox.Viewport class="source-viewport">
            {#each filtered as option (option.value)}
              <Combobox.Item
                value={option.value}
                label={[option.badge, option.label].filter(Boolean).join(" ")}
                class="source-option"
              >
                <span class="source-option-icon" aria-hidden="true"
                  ><FileTextIcon class="size-4" /></span
                >
                {#if option.badge}
                  <Badge
                    variant="secondary"
                    class="shrink-0 border-primary/15 bg-primary/10 px-1.5 py-0 text-[10px] text-primary"
                    >{option.badge}</Badge
                  >
                {/if}
                <span class="min-w-0 flex-1 truncate" title={option.label}
                  >{option.label}</span
                >
                {#if option.value === selectedTemplate}<span
                    class="source-document-check"
                    aria-hidden="true"><CheckIcon class="size-3" /></span
                  >
                {:else}<CornerDownLeftIcon
                    class="source-option-enter size-3.5 shrink-0"
                    aria-hidden="true"
                  />{/if}
              </Combobox.Item>
            {:else}
              <div class="source-empty" role="status">
                <FilesIcon
                  class="size-6 text-muted-foreground/60"
                  aria-hidden="true"
                /><span>{options.length ? labels.noMatch : labels.empty}</span>
              </div>
            {/each}
          </Combobox.Viewport>
        </Combobox.ContentStatic>
        <div class="source-library-footer" aria-hidden="true">
          <span><ArrowDownUpIcon class="size-3" />{labels.move}</span><span
            ><CornerDownLeftIcon class="size-3" />{labels.select}</span
          >
        </div>
      </Popover.Content>
    </Combobox.Root>
  </Popover.Root>
  {#if error}<p class="source-hint text-destructive" role="alert">{error}</p>
  {:else if hintText}<p class="source-hint text-muted-foreground">
      {hintText}
    </p>{/if}
</div>

<style>
  .source-field {
    container: input-source / inline-size;
    display: grid;
    gap: 0.625rem;
    min-width: 0;
  }
  .source-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--muted-foreground);
    letter-spacing: 0.02em;
  }
  .source-bar {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }
  .source-summary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.625rem;
    min-width: 0;
    min-height: 2.5rem;
    padding-left: 0.75rem;
    border-left: 1px solid var(--border);
  }
  .source-draft {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    color: var(--muted-foreground);
    font-size: 0.8125rem;
  }
  .source-status-dot {
    width: 0.375rem;
    height: 0.375rem;
    border-radius: 50%;
    background: var(--primary);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--primary) 10%, transparent);
  }
  .source-start {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    margin-left: auto;
    padding: 0.5rem 0.25rem;
    font-size: 0.75rem;
    color: var(--muted-foreground);
    cursor: pointer;
    transition: color 180ms;
  }
  .source-start:hover {
    color: var(--primary);
  }
  .source-document {
    display: flex;
    flex: 1 1 8rem;
    align-items: center;
    gap: 0.625rem;
    min-width: 0;
    height: 2.5rem;
    padding: 0 0.625rem;
    border: 1px solid var(--border);
    border-radius: 0.625rem;
    background: var(--background);
    text-align: left;
    cursor: pointer;
    transition:
      border-color 180ms,
      box-shadow 180ms;
  }
  .source-document:hover {
    border-color: color-mix(in oklab, var(--primary) 45%, var(--border));
    box-shadow: 0 2px 8px #00000005;
  }
  .source-document-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    flex-shrink: 0;
    border-radius: 0.375rem;
    background: var(--muted);
    color: var(--foreground);
  }
  .source-document-name {
    min-width: 0;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--foreground);
  }
  :global(.source-document-check) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
    border-radius: 50%;
    background: color-mix(in oklab, var(--primary) 12%, transparent);
    color: var(--primary);
  }
  .source-hint {
    margin: 0;
    font-size: 0.75rem;
    line-height: 1.6;
  }
  .source-disabled {
    opacity: 0.55;
  }
  .source-field button:disabled {
    cursor: not-allowed;
  }
  .source-field button:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 3px;
  }
  :global(.source-library) {
    padding: 0;
    gap: 0;
    z-index: 60;
    width: min(28rem, var(--bits-popover-anchor-width));
    min-width: min(20rem, calc(100vw - 2rem));
    max-width: calc(100vw - 2rem);
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 1rem;
    background: var(--popover);
    color: var(--popover-foreground);
    box-shadow:
      0 16px 48px -12px #00000030,
      0 2px 8px #00000008;
    outline: none;
    transform-origin: var(--bits-popover-content-transform-origin);
  }
  :global(.source-library[data-state="open"]) {
    animation: source-reveal 160ms ease-out;
  }
  :global(.source-search) {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0 1rem;
    border-bottom: 1px solid var(--border);
  }
  :global(.source-key) {
    padding: 0.125rem 0.25rem;
    border: 1px solid var(--border);
    border-radius: 0.25rem;
    font-size: 0.625rem;
    color: var(--muted-foreground);
  }
  :global(.source-library-heading) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.875rem 1rem 0.5rem;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--muted-foreground);
  }
  :global(.source-count) {
    font-variant-numeric: tabular-nums;
    font-weight: 400;
  }
  :global(.source-viewport) {
    max-height: min(19rem, 45dvh);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0 0.5rem 0.5rem;
  }
  :global(.source-option) {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
    min-height: 3rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid transparent;
    border-radius: 0.625rem;
    font-size: 0.8125rem;
    outline: none;
    cursor: pointer;
  }
  :global(.source-option[data-highlighted]) {
    border-color: color-mix(in oklab, var(--primary) 25%, var(--border));
    background: color-mix(in oklab, var(--primary) 10%, var(--popover));
  }
  :global(.source-option[data-selected]) {
    color: var(--primary);
  }
  :global(.source-option-icon) {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 1.875rem;
    height: 2.125rem;
    border: 1px solid var(--border);
    border-radius: 0.375rem;
    background: var(--background);
    color: var(--muted-foreground);
    box-shadow: 0 1px 2px #00000006;
  }
  :global(.source-option-enter) {
    opacity: 0;
    color: var(--muted-foreground);
  }
  :global(.source-option[data-highlighted] .source-option-enter) {
    opacity: 1;
  }
  :global(.source-empty) {
    display: grid;
    justify-items: center;
    gap: 0.75rem;
    padding: 2rem 1rem;
    text-align: center;
    font-size: 0.8125rem;
    color: var(--muted-foreground);
  }
  :global(.source-library-footer) {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.625rem 1rem;
    border-top: 1px solid var(--border);
    background: color-mix(in oklab, var(--muted) 35%, var(--popover));
    color: var(--muted-foreground);
    font-size: 0.6875rem;
  }
  :global(.source-library-footer > span) {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  @keyframes source-reveal {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.985);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  @container input-source (max-width: 36rem) {
    .source-bar {
      grid-template-columns: minmax(0, 1fr);
      gap: 0.625rem;
    }
    .source-summary {
      border-left: 0;
      padding-left: 0;
      min-height: 2rem;
    }
  }
  @media (max-width: 640px) {
    .source-bar {
      grid-template-columns: minmax(0, 1fr);
      gap: 0.625rem;
    }
    .source-summary {
      border-left: 0;
      padding-left: 0;
      min-height: 2rem;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .source-start,
    .source-document {
      transition: none;
    }
    :global(.source-library) {
      padding: 0;
      gap: 0;
      animation: none !important;
    }
  }
</style>

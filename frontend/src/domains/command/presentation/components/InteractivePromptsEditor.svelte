<script lang="ts">
  import { tick } from "svelte";
  import SearchIcon from "@lucide/svelte/icons/search";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import CornerDownLeftIcon from "@lucide/svelte/icons/corner-down-left";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { currentLanguageState, t } from "$lib/i18n.js";
  import { defaultInteractiveTemplatePromptModel } from "../../model/interactiveTemplate.js";
  import type { InteractiveTemplatePromptModel } from "../../model/types.js";
  import InteractivePromptEditor from "./InteractivePromptEditor.svelte";

  let {
    prompts,
    onChange,
  }: {
    prompts: InteractiveTemplatePromptModel[];
    onChange: (prompts: InteractiveTemplatePromptModel[]) => void;
  } = $props();
  let selectedIndex = $state(0);
  let query = $state("");
  let list: HTMLDivElement | undefined = $state();
  let root: HTMLDivElement | undefined = $state();
  const editorId = $props.id();
  let activeIndex = $derived(Math.min(selectedIndex, prompts.length - 1));
  let activePrompt = $derived(prompts[activeIndex]);
  let visibleRows = $derived(
    prompts
      .map((prompt, index) => ({ prompt, index }))
      .filter(({ prompt, index }) => {
        const text = query.trim().toLocaleLowerCase();
        return (
          !text ||
          [String(index + 1), ...prompt.patterns, prompt.response].some(
            (value) => value.toLocaleLowerCase().includes(text),
          )
        );
      }),
  );
  let labels = $derived.by(() => {
    $currentLanguageState;
    return {
      hint: t("interactivePromptsListHint"),
      search: t("interactivePromptsSearch"),
      empty: t("interactivePromptsEmpty"),
      noMatch: t("interactivePromptsNoMatch"),
      patternEmpty: t("interactivePromptsPatternEmpty"),
      responseEmpty: t("interactivePromptsResponseEmpty"),
      editing: t("interactivePromptsEditing").replace(
        "{number}",
        String(activeIndex + 1),
      ),
      rule: t("interactivePromptsRule"),
      add: t("interactiveAddPrompt"),
      copy: t("interactivePromptsDuplicate"),
      up: t("interactivePromptsMoveUp"),
      down: t("interactivePromptsMoveDown"),
      remove: t("interactivePromptsRemove"),
      list: t("interactivePrompts"),
      newline: t("interactiveAppendNewline"),
      results: t("interactivePromptsResults")
        .replace("{shown}", String(visibleRows.length))
        .replace("{total}", String(prompts.length)),
    };
  });

  async function focusRow(index: number) {
    await tick();
    const button = root?.querySelector<HTMLButtonElement>(
      `[data-prompt-row="${index}"]`,
    );
    button?.focus({ preventScroll: true });
    button?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  async function addPrompt(copy = false) {
    const index = copy ? activeIndex + 1 : prompts.length;
    const next = [...prompts];
    next.splice(
      index,
      0,
      copy && activePrompt
        ? { ...activePrompt, patterns: [...activePrompt.patterns] }
        : defaultInteractiveTemplatePromptModel(),
    );
    query = "";
    selectedIndex = index;
    onChange(next);
    await tick();
    const row = root?.querySelector<HTMLButtonElement>(
      `[data-prompt-row="${index}"]`,
    );
    if (row && list) {
      list.scrollTop +=
        row.getBoundingClientRect().top - list.getBoundingClientRect().top;
    }
    root
      ?.querySelector<HTMLInputElement>("[data-interactive-prompt] input")
      ?.focus();
  }

  function updatePrompt(prompt: InteractiveTemplatePromptModel) {
    onChange(
      prompts.map((current, index) =>
        index === activeIndex ? prompt : current,
      ),
    );
  }

  function movePrompt(offset: number) {
    const target = activeIndex + offset;
    if (target < 0 || target >= prompts.length) return;
    const next = [...prompts];
    const [prompt] = next.splice(activeIndex, 1);
    next.splice(target, 0, prompt);
    selectedIndex = target;
    query = "";
    onChange(next);
    void focusRow(target);
  }

  async function removePrompt() {
    const next = prompts.filter((_, index) => index !== activeIndex);
    selectedIndex = Math.max(0, Math.min(activeIndex, next.length - 1));
    query = "";
    onChange(next);
    if (next.length) await focusRow(selectedIndex);
    else {
      await tick();
      root?.querySelector<HTMLButtonElement>("[data-prompt-add]")?.focus();
    }
  }

  function navigate(event: KeyboardEvent, index: number) {
    const position = visibleRows.findIndex((row) => row.index === index);
    const target =
      event.key === "ArrowDown"
        ? position + 1
        : event.key === "ArrowUp"
          ? position - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? visibleRows.length - 1
              : null;
    if (target === null) return;
    event.preventDefault();
    const row =
      visibleRows[Math.max(0, Math.min(target, visibleRows.length - 1))];
    if (!row) return;
    selectedIndex = row.index;
    void focusRow(row.index);
  }
</script>

<div
  bind:this={root}
  class="prompts-manager grid min-w-0 gap-3"
  data-interactive-prompts-editor
>
  <div class="flex flex-wrap items-center justify-between gap-2">
    <p class="text-xs leading-relaxed text-muted-foreground">{labels.hint}</p>
    <Button
      data-prompt-add
      variant="outline"
      size="sm"
      onclick={() => addPrompt()}
      ><PlusIcon data-icon="inline-start" />{labels.add}</Button
    >
  </div>
  {#if prompts.length}
    <div
      class="min-w-0 overflow-hidden rounded-xl border border-border bg-card"
    >
      {#if prompts.length > 4 || query}
        <div class="flex items-center gap-2 border-b border-border px-3 py-2">
          <SearchIcon class="size-4 shrink-0 text-muted-foreground" />
          <Input
            class="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0"
            aria-label={labels.search}
            placeholder={labels.search}
            bind:value={query}
            onkeydown={(event) => {
              if (event.key === "Escape") query = "";
            }}
          />
          <span
            class="shrink-0 text-xs tabular-nums text-muted-foreground"
            aria-live="polite">{labels.results}</span
          >
        </div>
      {/if}
      <div
        bind:this={list}
        class="max-h-56 overflow-y-auto overscroll-contain p-1.5"
        role="group"
        aria-label={labels.list}
      >
        {#each visibleRows as { prompt, index } (index)}
          <button
            type="button"
            data-prompt-row={index}
            aria-pressed={index === activeIndex}
            aria-controls={editorId}
            class="prompt-row grid min-h-11 w-full min-w-0 items-center gap-2 rounded-lg border border-transparent px-2 py-2 text-left text-xs transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring aria-pressed:border-primary/20 aria-pressed:bg-primary/8"
            onclick={() => (selectedIndex = index)}
            onkeydown={(event) => navigate(event, index)}
          >
            <span
              class="prompt-number font-mono tabular-nums text-muted-foreground"
              aria-label={`${labels.rule} ${index + 1}`}
              >{String(index + 1).padStart(2, "0")}</span
            >
            <span class="prompt-pattern flex min-w-0 items-center gap-1.5">
              <span
                class="truncate font-mono"
                title={prompt.patterns.join("\n")}
                >{prompt.patterns[0] || labels.patternEmpty}</span
              >
              {#if prompt.patterns.length > 1}<span
                  class="shrink-0 rounded bg-muted px-1 font-mono text-muted-foreground"
                  >+{prompt.patterns.length - 1}</span
                >{/if}
            </span>
            <span class="prompt-direction"
              ><ArrowRightIcon class="size-3 text-muted-foreground" /></span
            >
            <span
              class="prompt-response truncate font-mono text-muted-foreground"
              title={prompt.response}
              >{prompt.response || labels.responseEmpty}</span
            >
            <span class="prompt-newline"
              >{#if prompt.appendNewline}<CornerDownLeftIcon
                  class="size-3.5 text-primary"
                  aria-label={labels.newline}
                />{/if}</span
            >
          </button>
        {:else}
          <p class="px-3 py-6 text-center text-xs text-muted-foreground">
            {labels.noMatch}
          </p>
        {/each}
      </div>
    </div>
    {#if activePrompt}
      <section
        id={editorId}
        class="min-w-0 overflow-hidden rounded-xl border border-primary/20 bg-card"
        aria-label={labels.editing}
      >
        <header
          class="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-primary/5 px-3 py-1.5"
        >
          <h5 class="text-xs font-semibold text-primary">{labels.editing}</h5>
          <div class="flex items-center gap-0.5">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={labels.up}
              title={labels.up}
              disabled={activeIndex === 0}
              onclick={() => movePrompt(-1)}><ArrowUpIcon /></Button
            >
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={labels.down}
              title={labels.down}
              disabled={activeIndex === prompts.length - 1}
              onclick={() => movePrompt(1)}><ArrowDownIcon /></Button
            >
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={labels.copy}
              title={labels.copy}
              onclick={() => addPrompt(true)}><CopyIcon /></Button
            >
            <Button
              size="icon-sm"
              variant="ghost"
              class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label={labels.remove}
              title={labels.remove}
              onclick={removePrompt}><Trash2Icon /></Button
            >
          </div>
        </header>
        <InteractivePromptEditor
          prompt={activePrompt}
          onChange={updatePrompt}
          embedded={true}
        />
      </section>
    {/if}
  {:else}
    <p
      class="rounded-xl border border-dashed border-border px-4 py-5 text-center text-xs leading-relaxed text-muted-foreground"
    >
      {labels.empty}
    </p>
  {/if}
</div>

<style>
  .prompts-manager {
    container-type: inline-size;
  }
  .prompt-row {
    grid-template-columns:
      1.5rem minmax(0, 1.2fr) 0.75rem minmax(0, 1fr)
      0.875rem;
  }
  @media (prefers-reduced-motion: reduce) {
    .prompt-row {
      transition: none;
    }
  }
  @container (max-width: 26rem) {
    .prompt-row {
      grid-template-columns: 1.5rem minmax(0, 1fr) 0.875rem;
      row-gap: 0.25rem;
    }
    .prompt-number {
      grid-row: 1 / 3;
    }
    .prompt-pattern {
      grid-column: 2;
      grid-row: 1;
    }
    .prompt-response {
      grid-column: 2;
      grid-row: 2;
    }
    .prompt-newline {
      grid-column: 3;
      grid-row: 1 / 3;
    }
    .prompt-direction {
      display: none;
    }
  }
</style>

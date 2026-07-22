<script>
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import {
    ChevronDownIcon,
    MessageSquareReplyIcon,
    PlusIcon,
    Trash2Icon,
  } from "@lucide/svelte";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import PlainTextAreaField from "../../components/fragments/PlainTextAreaField.svelte";

  let {
    display,
    idPrefix = "hook-interaction",
    interaction = {},
    onChange,
  } = $props();

  let expanded = $state(false);
  let previousPromptCount = $state(-1);
  let promptRows = $derived(display?.promptRows || []);
  let bodyId = $derived(`${idPrefix}-body`);

  function currentPrompts() {
    return Array.isArray(interaction?.prompts) ? interaction.prompts : [];
  }

  function updatePrompts(prompts) {
    onChange?.({ prompts });
  }

  function addPrompt() {
    updatePrompts([
      ...currentPrompts(),
      { patterns: [""], record_input: false, response: "" },
    ]);
    expanded = true;
  }

  function patchPrompt(promptIndex, patch) {
    updatePrompts(
      currentPrompts().map((prompt, currentIndex) =>
        currentIndex === promptIndex ? { ...prompt, ...patch } : prompt,
      ),
    );
  }

  function removePrompt(promptIndex) {
    updatePrompts(
      currentPrompts().filter(
        (_, currentIndex) => currentIndex !== promptIndex,
      ),
    );
  }

  function addPattern(promptIndex) {
    const prompt = currentPrompts()[promptIndex] || {};
    patchPrompt(promptIndex, {
      patterns: [
        ...(Array.isArray(prompt.patterns) ? prompt.patterns : []),
        "",
      ],
    });
  }

  function updatePattern(promptIndex, patternIndex, pattern) {
    const prompt = currentPrompts()[promptIndex] || {};
    const patterns = [
      ...(Array.isArray(prompt.patterns) ? prompt.patterns : []),
    ];
    patterns[patternIndex] = pattern;
    patchPrompt(promptIndex, { patterns });
  }

  function removePattern(promptIndex, patternIndex) {
    const prompt = currentPrompts()[promptIndex] || {};
    patchPrompt(promptIndex, {
      patterns: (Array.isArray(prompt.patterns) ? prompt.patterns : []).filter(
        (_, currentIndex) => currentIndex !== patternIndex,
      ),
    });
  }

  $effect(() => {
    const nextPromptCount = promptRows.length;
    if (previousPromptCount < 0 || nextPromptCount > previousPromptCount) {
      expanded = nextPromptCount > 0;
    }
    previousPromptCount = nextPromptCount;
  });
</script>

<section
  class="min-w-0 overflow-hidden rounded-md border border-border bg-background"
  aria-labelledby={`${idPrefix}-title`}
>
  <header
    class="flex min-w-0 flex-wrap items-center justify-between gap-2 px-3 py-2.5"
  >
    <Button
      class="min-w-0 justify-start px-1"
      type="button"
      variant="ghost"
      size="sm"
      aria-expanded={expanded}
      aria-controls={bodyId}
      onclick={() => (expanded = !expanded)}
    >
      <MessageSquareReplyIcon
        class="shrink-0 text-muted-foreground"
        data-icon="inline-start"
        aria-hidden="true"
      />
      <span id={`${idPrefix}-title`} class="truncate">{display.title}</span>
      <Badge variant="secondary" class="shrink-0 font-mono tabular-nums">
        {promptRows.length}
      </Badge>
      <ChevronDownIcon
        class={expanded
          ? "ml-1 size-3.5 shrink-0 transition-transform duration-200"
          : "ml-1 size-3.5 shrink-0 -rotate-90 transition-transform duration-200"}
        aria-hidden="true"
      />
    </Button>
    <Button
      type="button"
      variant="primary-outline"
      size="sm"
      onclick={addPrompt}
    >
      <PlusIcon data-icon="inline-start" aria-hidden="true" />
      {display.addPromptLabel}
    </Button>
  </header>

  <div
    id={bodyId}
    class="grid min-w-0 gap-3 border-t border-border bg-muted/15 p-3"
    hidden={!expanded}
  >
    <p class="text-xs leading-5 text-muted-foreground">
      {display.description}
    </p>

    {#if promptRows.length === 0}
      <div
        class="rounded-md border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground"
      >
        {display.emptyText}
      </div>
    {:else}
      {#each promptRows as promptRow (promptRow.promptIndex)}
        <article class="grid min-w-0 gap-3 rounded-md border border-border p-3">
          <header class="flex min-w-0 items-center justify-between gap-3">
            <div class="flex min-w-0 items-center gap-2">
              <Badge variant="outline" class="font-mono tabular-nums">
                {promptRow.promptIndex + 1}
              </Badge>
              <span class="text-xs font-semibold text-foreground">
                {display.promptLabel}
              </span>
            </div>
            <Button
              class="size-10 sm:size-8"
              type="button"
              variant="destructive"
              size="icon-sm"
              aria-label={`${display.deletePromptLabel} ${promptRow.promptIndex + 1}`}
              title={`${display.deletePromptLabel} ${promptRow.promptIndex + 1}`}
              onclick={() => removePrompt(promptRow.promptIndex)}
            >
              <Trash2Icon aria-hidden="true" />
            </Button>
          </header>

          <section class="grid min-w-0 gap-2">
            <header class="flex min-w-0 items-center justify-between gap-2">
              <span class="text-xs font-medium text-foreground">
                {display.patternLabel}
              </span>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onclick={() => addPattern(promptRow.promptIndex)}
              >
                <PlusIcon data-icon="inline-start" aria-hidden="true" />
                {display.addPatternLabel}
              </Button>
            </header>
            {#each promptRow.patternRows as patternRow (patternRow.patternIndex)}
              <div class="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <label class="grid min-w-0 gap-1.5">
                  <span class="sr-only">
                    {display.patternLabel}
                    {patternRow.patternIndex + 1}
                  </span>
                  <PlainInputField
                    value={patternRow.pattern}
                    placeholderText={display.patternPlaceholder}
                    onValueInput={(pattern) =>
                      updatePattern(
                        promptRow.promptIndex,
                        patternRow.patternIndex,
                        pattern,
                      )}
                  />
                </label>
                <Button
                  class="size-10 sm:size-9"
                  type="button"
                  variant="destructive"
                  size="icon"
                  aria-label={`${display.deletePatternLabel} ${patternRow.patternIndex + 1}`}
                  title={`${display.deletePatternLabel} ${patternRow.patternIndex + 1}`}
                  onclick={() =>
                    removePattern(
                      promptRow.promptIndex,
                      patternRow.patternIndex,
                    )}
                >
                  <Trash2Icon aria-hidden="true" />
                </Button>
              </div>
            {/each}
          </section>

          <div
            class="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(13rem,0.45fr)]"
          >
            <label class="grid min-w-0 gap-1.5">
              <span class="text-xs font-medium text-foreground">
                {display.responseLabel}
              </span>
              <PlainTextAreaField
                class="min-h-20 resize-y font-mono"
                value={promptRow.response}
                placeholderText={display.responsePlaceholder}
                onValueInput={(response) =>
                  patchPrompt(promptRow.promptIndex, { response })}
              />
            </label>
            <div
              class="flex min-h-20 items-center justify-between gap-4 rounded-md border border-border bg-muted/20 px-3 py-2"
            >
              <div class="min-w-0">
                <label
                  for={`${idPrefix}-prompt-${promptRow.promptIndex}-record-input`}
                  class="text-xs font-medium text-foreground"
                >
                  {display.recordInputLabel}
                </label>
                <p class="mt-1 text-xs leading-5 text-muted-foreground">
                  {display.recordInputDescription}
                </p>
              </div>
              <Switch
                id={`${idPrefix}-prompt-${promptRow.promptIndex}-record-input`}
                class="shrink-0"
                checked={promptRow.record_input}
                aria-label={display.recordInputLabel}
                onCheckedChange={(record_input) =>
                  patchPrompt(promptRow.promptIndex, { record_input })}
              />
            </div>
          </div>
        </article>
      {/each}
    {/if}
  </div>
</section>

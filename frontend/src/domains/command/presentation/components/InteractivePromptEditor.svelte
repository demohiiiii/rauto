<script lang="ts">
  import PlusIcon from "@lucide/svelte/icons/plus";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { Button } from "$lib/components/ui/button/index.js";
  import PlainCheckboxField from "$components/fragments/PlainCheckboxField.svelte";
  import PlainInputField from "$components/fragments/PlainInputField.svelte";
  import { currentLanguageState, t } from "$lib/i18n.js";
  import {
    interactiveAccentColor,
    defaultInteractiveTemplatePromptModel,
    type InteractiveTemplatePromptModel,
  } from "$domains/command/index.js";

  interface Props {
    embedded?: boolean;
    accentIndex?: number;
    onChange?: (prompt: InteractiveTemplatePromptModel) => void;
    onRemove?: () => void;
    prompt?: InteractiveTemplatePromptModel;
  }

  let {
    embedded = false,
    accentIndex = 0,
    onChange,
    onRemove,
    prompt = defaultInteractiveTemplatePromptModel(),
  }: Props = $props();
  let accentColor = $derived(interactiveAccentColor(accentIndex));

  let labels = $derived.by(() => {
    $currentLanguageState;
    return {
      patterns: t("interactivePromptPatterns"),
      add: t("interactiveAddPattern"),
      remove: t("deleteBtn"),
      patternPlaceholder: t("interactivePromptPatternPlaceholder"),
      response: t("interactivePromptResponse"),
      responsePlaceholder: t("interactivePromptResponsePlaceholder"),
      newline: t("interactiveAppendNewline"),
      record: t("interactiveRecordInput"),
      removePattern: t("interactivePromptsRemovePattern"),
    };
  });

  function patchPrompt(patch: Partial<InteractiveTemplatePromptModel>): void {
    onChange?.({ ...prompt, ...patch });
  }

  function addPattern(): void {
    patchPrompt({ patterns: [...(prompt.patterns || []), ""] });
  }

  function removePattern(patternIndex: number): void {
    const patterns = [...(prompt.patterns || [])];
    patterns.splice(patternIndex, 1);
    patchPrompt({ patterns });
  }

  function updatePattern(patternIndex: number, pattern: string): void {
    const patterns = [...(prompt.patterns || [])];
    patterns[patternIndex] = pattern;
    patchPrompt({ patterns });
  }
</script>

<div
  data-interactive-prompt
  style:--interactive-accent={accentColor}
  class={embedded
    ? "grid min-w-0 gap-4 p-3"
    : "interactive-prompt-card grid min-w-0 gap-4 rounded-lg border p-3"}
>
  <div class="grid min-w-0 gap-2">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <span class="text-xs font-medium">{labels.patterns}</span>
      <Button variant="ghost" size="sm" onclick={addPattern}
        ><PlusIcon data-icon="inline-start" />{labels.add}</Button
      >
    </div>
    <div class="grid max-h-56 gap-2 overflow-y-auto overscroll-contain p-1">
      {#each prompt.patterns as pattern, patternIndex (patternIndex)}
        <div
          class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1"
        >
          <PlainInputField
            class="font-mono text-xs"
            aria-label={`${labels.patterns} ${patternIndex + 1}`}
            placeholderText={labels.patternPlaceholder}
            value={pattern}
            onValueInput={(value) => updatePattern(patternIndex, value)}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            class="text-muted-foreground hover:text-destructive"
            aria-label={`${labels.removePattern} ${patternIndex + 1}`}
            title={labels.removePattern}
            onclick={() => removePattern(patternIndex)}><Trash2Icon /></Button
          >
        </div>
      {/each}
    </div>
  </div>

  <label class="grid gap-2">
    <span class="text-xs font-medium text-foreground">
      {labels.response}
    </span>
    <PlainInputField
      value={prompt.response || ""}
      placeholderText={labels.responsePlaceholder}
      onValueInput={(response) => patchPrompt({ response })}
    />
  </label>

  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex flex-wrap items-center gap-4">
      <PlainCheckboxField
        controlKind="switch"
        checked={!!prompt.appendNewline}
        labelText={labels.newline}
        onCheckedChange={(appendNewline: boolean) =>
          patchPrompt({ appendNewline })}
      />
      <PlainCheckboxField
        controlKind="switch"
        checked={!!prompt.recordInput}
        labelText={labels.record}
        onCheckedChange={(recordInput: boolean) => patchPrompt({ recordInput })}
      />
    </div>
    {#if onRemove}<Button
        variant="destructive"
        size="sm"
        type="button"
        onclick={onRemove}
      >
        <Trash2Icon data-icon="inline-start" />
        {labels.remove}
      </Button>{/if}
  </div>
</div>

<style>
  .interactive-prompt-card {
    border-color: color-mix(
      in oklab,
      var(--interactive-accent) 32%,
      var(--border)
    );
    background: color-mix(in oklab, var(--interactive-accent) 5%, var(--card));
    box-shadow: inset 3px 0 0 var(--interactive-accent);
  }
</style>

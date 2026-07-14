<script>
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { Button } from "$lib/components/ui/button/index.js";
  import PlainCheckboxField from "../fragments/PlainCheckboxField.svelte";
  import PlainInputField from "../fragments/PlainInputField.svelte";
  import StringListEditor from "../fragments/StringListEditor.svelte";
  import { t } from "../../lib/i18n.js";
  import { commandFlowAccentColor } from "../../modules/commandFlowAccentState.js";

  let { accentIndex = 0, onChange, onRemove, prompt = {} } = $props();
  let accentColor = $derived(commandFlowAccentColor(accentIndex));

  let patternRows = $derived(
    (Array.isArray(prompt.patterns) ? prompt.patterns : []).map(
      (pattern, itemIndex) => ({ itemIndex, text: pattern }),
    ),
  );

  function patchPrompt(patch) {
    onChange?.({ ...prompt, ...patch });
  }

  function addPattern() {
    patchPrompt({ patterns: [...(prompt.patterns || []), ""] });
  }

  function removePattern(patternIndex) {
    const patterns = [...(prompt.patterns || [])];
    patterns.splice(patternIndex, 1);
    patchPrompt({ patterns });
  }

  function updatePattern(patternIndex, pattern) {
    const patterns = [...(prompt.patterns || [])];
    patterns[patternIndex] = pattern;
    patchPrompt({ patterns });
  }
</script>

<div
  data-command-flow-prompt
  style:--command-flow-accent={accentColor}
  class="command-flow-prompt-card grid gap-3 rounded-lg border p-3"
>
  <StringListEditor
    labelText={t("commandFlowPromptPatterns")}
    itemRows={patternRows}
    addButtonLabel={t("commandFlowAddPattern")}
    removeButtonLabel={t("deleteBtn")}
    placeholderText={t("commandFlowPromptPatternPlaceholder")}
    onAdd={addPattern}
    onRemove={removePattern}
    onValueChange={updatePattern}
  />

  <label class="grid gap-2">
    <span class="text-sm font-medium text-foreground">
      {t("commandFlowPromptResponse")}
    </span>
    <PlainInputField
      value={prompt.response || ""}
      placeholderText={t("commandFlowPromptResponsePlaceholder")}
      onValueInput={(response) => patchPrompt({ response })}
    />
  </label>

  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex flex-wrap items-center gap-4">
      <PlainCheckboxField
        controlKind="switch"
        checked={!!prompt.appendNewline}
        labelText={t("commandFlowAppendNewline")}
        onCheckedChange={(appendNewline) => patchPrompt({ appendNewline })}
      />
      <PlainCheckboxField
        controlKind="switch"
        checked={!!prompt.recordInput}
        labelText={t("commandFlowRecordInput")}
        onCheckedChange={(recordInput) => patchPrompt({ recordInput })}
      />
    </div>
    <Button variant="destructive" size="sm" type="button" onclick={onRemove}>
      <Trash2Icon data-icon="inline-start" />
      {t("deleteBtn")}
    </Button>
  </div>
</div>

<style>
  .command-flow-prompt-card {
    border-color: color-mix(
      in oklab,
      var(--command-flow-accent) 32%,
      var(--border)
    );
    background: color-mix(in oklab, var(--command-flow-accent) 5%, var(--card));
    box-shadow: inset 3px 0 0 var(--command-flow-accent);
  }
</style>

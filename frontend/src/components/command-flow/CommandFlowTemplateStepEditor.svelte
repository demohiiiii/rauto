<script>
  import PlusIcon from "@lucide/svelte/icons/plus";
  import { Button } from "$lib/components/ui/button/index.js";
  import PlainCheckboxField from "../fragments/PlainCheckboxField.svelte";
  import PlainInputField from "../fragments/PlainInputField.svelte";
  import StringSelectField from "../fragments/StringSelectField.svelte";
  import { t } from "../../lib/i18n.js";
  import { defaultCommandFlowTemplatePromptModel } from "../../modules/commandFlowTemplateModel.js";
  import CommandEditor from "./CommandEditor.svelte";
  import CommandFlowTemplatePromptEditor from "./CommandFlowTemplatePromptEditor.svelte";

  let { accentIndex = 0, modeOptions = [], onChange, step = {} } = $props();

  function patchStep(patch) {
    onChange?.({ ...step, ...patch });
  }

  function addPrompt() {
    patchStep({
      prompts: [
        ...(Array.isArray(step.prompts) ? step.prompts : []),
        defaultCommandFlowTemplatePromptModel(),
      ],
    });
  }

  function removePrompt(promptIndex) {
    const prompts = [...(step.prompts || [])];
    prompts.splice(promptIndex, 1);
    patchStep({ prompts });
  }

  function updatePrompt(promptIndex, prompt) {
    const prompts = [...(step.prompts || [])];
    prompts[promptIndex] = prompt;
    patchStep({ prompts });
  }
</script>

<div class="grid gap-4">
  <CommandEditor
    command={step.command || ""}
    multilineMode={step.multilineMode || "split_lines"}
    placeholderText={t("commandFlowCommandPlaceholder")}
    onCommandChange={(command) => patchStep({ command })}
    onMultilineModeChange={(multilineMode) => patchStep({ multilineMode })}
  >
    <div class="grid gap-3 md:grid-cols-2">
      <div class="grid gap-2">
        <PlainCheckboxField
          controlKind="switch"
          checked={!!step.hasMode}
          labelText={t("commandFlowOverrideMode")}
          onCheckedChange={(hasMode) =>
            patchStep({ hasMode, mode: hasMode ? (step.mode ?? "") : null })}
        />
        <StringSelectField
          value={step.mode || ""}
          optionValues={modeOptions}
          includeEmptyOption={true}
          placeholderText={t("txBlockFormMode")}
          disabled={!step.hasMode}
          onValueChange={(mode) => patchStep({ mode, hasMode: true })}
        />
      </div>

      <div class="grid gap-2">
        <PlainCheckboxField
          controlKind="switch"
          checked={!!step.hasTimeoutSecs}
          labelText={t("commandFlowOverrideTimeout")}
          onCheckedChange={(hasTimeoutSecs) =>
            patchStep({
              hasTimeoutSecs,
              timeoutSecs: hasTimeoutSecs ? (step.timeoutSecs ?? 30) : null,
            })}
        />
        <PlainInputField
          type="number"
          min="0"
          step="1"
          value={step.timeoutSecs ?? ""}
          placeholderText={t("txBlockFormTimeout")}
          disabled={!step.hasTimeoutSecs}
          onValueInput={(value) =>
            patchStep({
              timeoutSecs: value === "" ? null : Number(value),
              hasTimeoutSecs: true,
            })}
        />
      </div>
    </div>
  </CommandEditor>

  <div class="grid gap-3 border-t border-border pt-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h4 class="text-sm font-semibold text-foreground">
          {t("commandFlowPrompts")}
        </h4>
        <p class="text-xs text-muted-foreground">
          {t("commandFlowPromptsHint")}
        </p>
      </div>
      <Button variant="outline" size="sm" type="button" onclick={addPrompt}>
        <PlusIcon data-icon="inline-start" />
        {t("commandFlowAddPrompt")}
      </Button>
    </div>

    {#each step.prompts || [] as prompt, promptIndex (promptIndex)}
      <CommandFlowTemplatePromptEditor
        accentIndex={accentIndex * 2 + promptIndex + 1}
        {prompt}
        onChange={(nextPrompt) => updatePrompt(promptIndex, nextPrompt)}
        onRemove={() => removePrompt(promptIndex)}
      />
    {/each}
  </div>
</div>

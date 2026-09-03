<script lang="ts">
  import PlusIcon from "@lucide/svelte/icons/plus";
  import { Button } from "$lib/components/ui/button/index.js";
  import ModeExpressionField from "$components/fragments/ModeExpressionField.svelte";
  import PlainCheckboxField from "$components/fragments/PlainCheckboxField.svelte";
  import PlainInputField from "$components/fragments/PlainInputField.svelte";
  import { t } from "$lib/i18n.js";
  import {
    defaultCommandFlowTemplatePromptModel,
    defaultCommandFlowTemplateStepModel,
    type CommandFlowTemplatePromptModel,
    type CommandFlowTemplateStepModel,
  } from "$domains/command/index.js";
  import CommandEditor from "./CommandEditor.svelte";
  import CommandFlowTemplatePromptEditor from "./CommandFlowTemplatePromptEditor.svelte";

  interface Props {
    accentIndex?: number;
    modeOptions?: string[];
    onChange?: (step: CommandFlowTemplateStepModel) => void;
    step?: CommandFlowTemplateStepModel;
  }

  let {
    accentIndex = 0,
    modeOptions = [],
    onChange,
    step = defaultCommandFlowTemplateStepModel(),
  }: Props = $props();

  function patchStep(patch: Partial<CommandFlowTemplateStepModel>): void {
    onChange?.({ ...step, ...patch });
  }

  function addPrompt(): void {
    patchStep({
      prompts: [
        ...(Array.isArray(step.prompts) ? step.prompts : []),
        defaultCommandFlowTemplatePromptModel(),
      ],
    });
  }

  function removePrompt(promptIndex: number): void {
    const prompts = [...(step.prompts || [])];
    prompts.splice(promptIndex, 1);
    patchStep({ prompts });
  }

  function updatePrompt(
    promptIndex: number,
    prompt: CommandFlowTemplatePromptModel,
  ): void {
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
          onCheckedChange={(hasMode: boolean) =>
            patchStep({ hasMode, mode: hasMode ? (step.mode ?? "") : null })}
        />
        <ModeExpressionField
          value={step.mode || ""}
          optionValues={modeOptions}
          placeholderText={t("txBlockFormMode")}
          disabled={!step.hasMode}
          onValueChange={(mode: string) => patchStep({ mode, hasMode: true })}
        />
      </div>

      <div class="grid gap-2">
        <PlainCheckboxField
          controlKind="switch"
          checked={!!step.hasTimeoutSecs}
          labelText={t("commandFlowOverrideTimeout")}
          onCheckedChange={(hasTimeoutSecs: boolean) =>
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

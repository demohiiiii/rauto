<script lang="ts">
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import SlidersHorizontalIcon from "@lucide/svelte/icons/sliders-horizontal";
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";
  import ModeExpressionField from "$components/fragments/ModeExpressionField.svelte";
  import PlainCheckboxField from "$components/fragments/PlainCheckboxField.svelte";
  import PlainInputField from "$components/fragments/PlainInputField.svelte";
  import { currentLanguageState, t } from "$lib/i18n.js";
  import {
    defaultInteractiveCommandModel,
    type InteractiveCommandModel,
  } from "$domains/command/index.js";
  import CommandEditor from "./CommandEditor.svelte";
  import InteractivePromptsEditor from "./InteractivePromptsEditor.svelte";

  interface Props {
    compact?: boolean;
    accentIndex?: number;
    modeOptions?: string[];
    onChange?: (step: InteractiveCommandModel) => void;
    step?: InteractiveCommandModel;
  }

  let {
    compact = false,
    modeOptions = [],
    onChange,
    step = defaultInteractiveCommandModel(),
  }: Props = $props();
  let promptsOpen = $state(false);
  let previouslyHadPrompts = false;
  $effect(() => {
    const hasPrompts = (step.prompts?.length || 0) > 0;
    if (hasPrompts && !previouslyHadPrompts) promptsOpen = true;
    previouslyHadPrompts = hasPrompts;
  });
  let optionsLabel = $derived.by(() => {
    $currentLanguageState;
    return t("interactiveStudioStepOptions");
  });

  function patchStep(patch: Partial<InteractiveCommandModel>): void {
    onChange?.({ ...step, ...patch });
  }
</script>

{#snippet settingsFields()}
  <div class="grid gap-3 md:grid-cols-2">
    <div class="grid gap-2">
      <PlainCheckboxField
        controlKind="switch"
        checked={!!step.hasMode}
        labelText={t("interactiveOverrideMode")}
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
        labelText={t("interactiveOverrideTimeout")}
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
{/snippet}

{#snippet promptFields()}
  <InteractivePromptsEditor
    prompts={step.prompts || []}
    onChange={(prompts) => patchStep({ prompts })}
  />
{/snippet}

<div class="grid gap-4">
  <CommandEditor
    command={step.command || ""}
    multilineMode={step.multilineMode || "split_lines"}
    placeholderText={t("interactiveCommandPlaceholder")}
    onCommandChange={(command) => patchStep({ command })}
    onMultilineModeChange={(multilineMode) => patchStep({ multilineMode })}
  >
    {#if !compact}{@render settingsFields()}{/if}
  </CommandEditor>
  {#if compact}
    <div class="grid gap-1 border-t border-border/70 pt-2">
      <details class="group/options rounded-lg open:bg-muted/25">
        <summary
          class="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-2 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden"
        >
          <ChevronRightIcon
            class="size-3.5 shrink-0 transition-transform group-open/options:rotate-90 motion-reduce:transition-none"
          />
          <SlidersHorizontalIcon class="size-3.5 shrink-0" />
          <span class="font-medium text-foreground">{optionsLabel}</span>
          <span class="ml-auto truncate font-mono"
            >{step.hasMode
              ? step.mode
              : t("interactiveReadonlyInherited")}</span
          >
        </summary>
        <div class="p-3 pt-1">{@render settingsFields()}</div>
      </details>
      <details
        class="group/prompts rounded-lg open:bg-muted/25"
        bind:open={promptsOpen}
      >
        <summary
          class="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden"
        >
          <ChevronRightIcon
            class="size-3.5 shrink-0 transition-transform group-open/prompts:rotate-90 motion-reduce:transition-none"
          />
          <MessageSquareIcon class="size-3.5 shrink-0" />
          <span class="font-medium text-foreground"
            >{t("interactivePrompts")}</span
          >
          <span class="ml-auto rounded-md bg-muted px-1.5 py-0.5 font-mono"
            >{step.prompts?.length || 0}</span
          >
        </summary>
        <div class="p-3 pt-1">{@render promptFields()}</div>
      </details>
    </div>
  {:else}
    <div class="border-t border-border pt-3">{@render promptFields()}</div>
  {/if}
</div>

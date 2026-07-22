<script>
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import {
    ListChecksIcon,
    MessageSquareReplyIcon,
    TerminalIcon,
    WorkflowIcon,
  } from "@lucide/svelte";
  import ReadonlyInputField from "../../components/fragments/ReadonlyInputField.svelte";
  import ReadonlyTextAreaField from "../../components/fragments/ReadonlyTextAreaField.svelte";
  import { createBuiltinProfileHooksSectionWorkspace } from "../../modules/profiles/profiles.js";

  let { profileDetail } = $props();
  const hooksWorkspace = createBuiltinProfileHooksSectionWorkspace();
  let hooksDisplayStateStore = $derived(hooksWorkspace.hooksDisplayStateStore);
  let hooksDisplay = $derived($hooksDisplayStateStore);
</script>

{#snippet readonlyInput(labelText, value, inputClass = "")}
  <div class="grid min-w-0 gap-1.5">
    <span class="text-xs font-medium text-foreground">{labelText}</span>
    <ReadonlyInputField class={inputClass} {value} />
  </div>
{/snippet}

{#snippet readonlyTextArea(labelText, value)}
  <div class="grid min-w-0 gap-1.5">
    <span class="text-xs font-medium text-foreground">{labelText}</span>
    <ReadonlyTextAreaField class="min-h-20 font-mono" {value} />
  </div>
{/snippet}

{#snippet readonlySwitch(labelText, checked)}
  <div
    class="flex min-h-9 items-center justify-between gap-3 rounded-md border border-border px-3"
  >
    <span class="min-w-0 text-xs text-muted-foreground">{labelText}</span>
    <Switch class="shrink-0" {checked} aria-label={labelText} disabled />
  </div>
{/snippet}

{#snippet readonlyHookInteraction(interactionDisplay)}
  <section
    class="min-w-0 overflow-hidden rounded-md border border-border bg-background"
  >
    <header class="flex min-w-0 items-center gap-2 px-3 py-2.5">
      <MessageSquareReplyIcon
        class="size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <span class="text-xs font-semibold text-foreground">
        {interactionDisplay.title}
      </span>
      <Badge variant="secondary" class="font-mono tabular-nums">
        {interactionDisplay.promptRows.length}
      </Badge>
    </header>
    {#if interactionDisplay.promptRows.length > 0}
      <div class="grid min-w-0 gap-3 border-t border-border bg-muted/15 p-3">
        <p class="text-xs leading-5 text-muted-foreground">
          {interactionDisplay.description}
        </p>
        {#each interactionDisplay.promptRows as promptRow}
          <article
            class="grid min-w-0 gap-3 rounded-md border border-border p-3"
          >
            <header class="flex min-w-0 items-center gap-2">
              <Badge variant="outline" class="font-mono tabular-nums">
                {promptRow.promptIndex + 1}
              </Badge>
              <span class="text-xs font-semibold text-foreground">
                {interactionDisplay.promptLabel}
              </span>
            </header>
            <div class="grid min-w-0 gap-2">
              <span class="text-xs font-medium text-foreground">
                {interactionDisplay.patternLabel}
              </span>
              {#each promptRow.patternRows as patternRow}
                <ReadonlyInputField
                  class="font-mono"
                  value={patternRow.pattern}
                />
              {/each}
            </div>
            <div
              class="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(13rem,0.45fr)]"
            >
              {@render readonlyTextArea(
                interactionDisplay.responseLabel,
                promptRow.response,
              )}
              {@render readonlySwitch(
                interactionDisplay.recordInputLabel,
                promptRow.record_input,
              )}
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </section>
{/snippet}

{#snippet readonlyHookStep(hookStep)}
  <article class="grid min-w-0 gap-3 rounded-md border border-border p-3">
    <header class="flex min-w-0 items-center gap-2">
      <Badge variant="outline" class="font-mono tabular-nums">
        {hookStep.stepIndex + 1}
      </Badge>
      <span class="text-xs font-semibold text-foreground">
        {hooksDisplay.stepLabel}
      </span>
    </header>
    <div
      class="grid min-w-0 gap-3 lg:grid-cols-[minmax(9rem,0.35fr)_minmax(0,1fr)_minmax(7rem,0.28fr)]"
    >
      {@render readonlyInput(hooksDisplay.modeLabel, hookStep.mode)}
      {@render readonlyTextArea(hooksDisplay.commandLabel, hookStep.command)}
      {@render readonlyInput(hooksDisplay.timeoutLabel, hookStep.timeout)}
    </div>
    {@render readonlyHookInteraction(hookStep.interactionDisplay)}
  </article>
{/snippet}

{#snippet readonlyHookCommand(operation)}
  <div
    class="grid min-w-0 gap-3 rounded-md border border-border bg-muted/20 p-3"
  >
    <div
      class="grid min-w-0 gap-3 lg:grid-cols-[minmax(9rem,0.35fr)_minmax(0,1fr)_minmax(7rem,0.28fr)]"
    >
      {@render readonlyInput(hooksDisplay.modeLabel, operation.mode)}
      {@render readonlyTextArea(hooksDisplay.commandLabel, operation.command)}
      {@render readonlyInput(hooksDisplay.timeoutLabel, operation.timeout)}
    </div>
    {@render readonlyHookInteraction(operation.interactionDisplay)}
  </div>
{/snippet}

{#snippet hookReadonlyRow(hookRow)}
  <article
    class="min-w-0 overflow-hidden rounded-lg border border-border bg-background shadow-xs"
  >
    <header
      class="flex min-w-0 items-start justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3"
    >
      <div class="min-w-0">
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <h4 class="break-words text-sm font-semibold text-foreground">
            {hookRow.name}
          </h4>
          <Badge variant="secondary">
            {hookRow.showFlowSteps
              ? hooksDisplay.flowKindLabel
              : hooksDisplay.commandKindLabel}
          </Badge>
        </div>
        <p class="mt-1 text-xs leading-5 text-muted-foreground">
          {hooksDisplay.description}
        </p>
      </div>
    </header>

    <div class="grid min-w-0 gap-4 p-4">
      <div
        class="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(9rem,0.8fr)_minmax(9rem,0.8fr)_minmax(12rem,1.4fr)_minmax(12rem,1fr)]"
      >
        {@render readonlyInput(hooksDisplay.triggerLabel, hookRow.trigger)}
        {@render readonlyInput(hooksDisplay.stateLabel, hookRow.stateText)}
        {@render readonlyInput(hooksDisplay.nameLabel, hookRow.name)}
        {@render readonlyInput(
          hooksDisplay.failurePolicyLabel,
          hookRow.failurePolicy,
        )}
        <div class="md:col-span-2 xl:col-span-1">
          {@render readonlySwitch(
            hooksDisplay.recordOutputLabel,
            hookRow.recordOutput,
          )}
        </div>
      </div>

      <Separator />

      <section class="grid min-w-0 gap-4">
        <div class="min-w-0">
          <h5 class="text-xs font-semibold text-foreground">
            {hooksDisplay.kindLabel}
          </h5>
          <div
            class="mt-2 flex items-center gap-2 text-xs text-muted-foreground"
          >
            {#if hookRow.showFlowSteps}
              <WorkflowIcon class="size-4 shrink-0" aria-hidden="true" />
              <span>{hooksDisplay.flowKindLabel}</span>
            {:else}
              <TerminalIcon class="size-4 shrink-0" aria-hidden="true" />
              <span>{hooksDisplay.commandKindLabel}</span>
            {/if}
          </div>
        </div>

        {#if hookRow.showFlowSteps}
          <section class="grid min-w-0 gap-4">
            <div
              class="grid min-w-0 gap-3 rounded-md border border-border bg-muted/20 p-3"
            >
              <h6 class="text-xs font-semibold text-foreground">
                {hooksDisplay.flowSettingsTitle}
              </h6>
              <div class="grid min-w-0 gap-3 md:grid-cols-2">
                {@render readonlySwitch(
                  hooksDisplay.stopOnErrorLabel,
                  hookRow.flowStopOnError,
                )}
                {@render readonlyInput(
                  hooksDisplay.maxStepsLabel,
                  hookRow.flowMaxSteps,
                )}
              </div>
            </div>

            <div class="grid min-w-0 gap-3">
              <header class="flex min-w-0 items-center gap-2">
                <ListChecksIcon
                  class="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <h6 class="text-xs font-semibold text-foreground">
                  {hooksDisplay.flowStepsTitle}
                </h6>
                <Badge variant="secondary" class="font-mono tabular-nums">
                  {hookRow.flowSteps.length}
                </Badge>
              </header>
              {#each hookRow.flowSteps as hookStep}
                {@render readonlyHookStep(hookStep)}
              {/each}
            </div>
          </section>
        {:else}
          {@render readonlyHookCommand(hookRow.command)}
        {/if}
      </section>
    </div>
  </article>
{/snippet}

<section class="overflow-hidden rounded-lg border border-border bg-card/50">
  <header class="flex items-start gap-3 border-b border-border px-4 py-4">
    <div
      class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
    >
      <WorkflowIcon class="size-4" aria-hidden="true" />
    </div>
    <div class="min-w-0">
      <h3 class="text-sm font-semibold">{hooksDisplay.title}</h3>
      <p class="mt-1 text-xs leading-5 text-muted-foreground">
        {profileDetail.detailDisplay.hooksDescription}
      </p>
    </div>
  </header>
  <div
    class="grid min-w-0 gap-3 p-4"
    role="group"
    aria-label={hooksDisplay.ariaLabelText}
  >
    {#if !profileDetail.hasHookRows}
      <div
        class="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground"
      >
        {profileDetail.detailDisplay.rulesEmpty}
      </div>
    {:else}
      {#each profileDetail.hookRows as hookRow}
        {@render hookReadonlyRow(hookRow)}
      {/each}
    {/if}
  </div>
</section>

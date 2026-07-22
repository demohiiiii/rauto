<script>
  import CollapsibleGroup from "../../components/fragments/CollapsibleGroup.svelte";
  import ReadonlyCheckboxField from "../../components/fragments/ReadonlyCheckboxField.svelte";
  import ReadonlyInputField from "../../components/fragments/ReadonlyInputField.svelte";
  import { createBuiltinProfileStateListsSectionWorkspace } from "../../modules/profiles/profiles.js";

  let { profileDetail } = $props();
  const stateListsWorkspace = createBuiltinProfileStateListsSectionWorkspace();
  let stateListsDisplayStateStore = $derived(
    stateListsWorkspace.stateListsDisplayStateStore,
  );
  let stateListsDisplay = $derived($stateListsDisplayStateStore);
</script>

{#snippet readonlyFieldCard(readonlyValue)}
  <div class="rounded-lg border border-border bg-muted/40 p-3">
    <ReadonlyInputField value={readonlyValue} />
  </div>
{/snippet}

{#snippet readonlySectionHeader(titleText)}
  <span class="min-w-0 break-words text-xs font-semibold sm:text-sm">
    {titleText}
  </span>
{/snippet}

{#snippet readonlyPatternRows(patternRows)}
  <div class="grid gap-2">
    {#each patternRows as patternRow}
      {@render readonlyFieldCard(patternRow.value)}
    {/each}
  </div>
{/snippet}

<CollapsibleGroup
  variant="section"
  class="px-4 py-4"
  label={stateListsDisplay.promptsTitle}
  toggle-mode="icon"
  body-class="mt-3 grid gap-2"
  persistenceKey="builtin-prompts-list"
>
  {#snippet header()}
    <div class="flex min-w-0 flex-1 items-center gap-2">
      {@render readonlySectionHeader(stateListsDisplay.promptsTitle)}
      <span
        class="flex min-w-6 items-center justify-center rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
      >
        {profileDetail.promptRows.length}
      </span>
    </div>
  {/snippet}

  {#each profileDetail.promptRows as promptRow}
    <div class="grid gap-2 rounded-lg border border-border bg-muted/40 p-3">
      <ReadonlyInputField value={promptRow.state} />
      {@render readonlyPatternRows(promptRow.patternRows)}
    </div>
  {/each}
  {#if profileDetail.promptRows.length === 0}
    <div
      class="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground"
    >
      {profileDetail.detailDisplay.rulesEmpty}
    </div>
  {/if}
</CollapsibleGroup>

<CollapsibleGroup
  variant="section"
  class="px-4 py-4"
  label={stateListsDisplay.sysPromptsTitle}
  toggle-mode="icon"
  body-class="mt-3 grid gap-2"
  persistenceKey="builtin-sys-prompts-list"
>
  {#snippet header()}
    <div class="flex min-w-0 flex-1 items-center gap-2">
      {@render readonlySectionHeader(stateListsDisplay.sysPromptsTitle)}
      <span
        class="flex min-w-6 items-center justify-center rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
      >
        {profileDetail.sysPromptRows.length}
      </span>
    </div>
  {/snippet}

  {#each profileDetail.sysPromptRows as sysPromptRow}
    <div
      class="grid gap-2 rounded-lg border border-border bg-muted/40 p-3 md:grid-cols-3"
    >
      <ReadonlyInputField value={sysPromptRow.state} />
      <ReadonlyInputField value={sysPromptRow.sysNameGroup} />
      <ReadonlyInputField value={sysPromptRow.pattern} />
    </div>
  {/each}
  {#if profileDetail.sysPromptRows.length === 0}
    <div
      class="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground"
    >
      {profileDetail.detailDisplay.rulesEmpty}
    </div>
  {/if}
</CollapsibleGroup>

<CollapsibleGroup
  variant="section"
  class="px-4 py-4"
  label={stateListsDisplay.interactionsTitle}
  toggle-mode="icon"
  body-class="mt-3 grid gap-2"
  persistenceKey="builtin-interactions-list"
>
  {#snippet header()}
    <div class="flex min-w-0 flex-1 items-center gap-2">
      {@render readonlySectionHeader(stateListsDisplay.interactionsTitle)}
      <span
        class="flex min-w-6 items-center justify-center rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
      >
        {profileDetail.interactionRows.length}
      </span>
    </div>
  {/snippet}

  {#each profileDetail.interactionRows as interactionRow}
    <div class="grid gap-2 rounded-lg border border-border bg-muted/40 p-3">
      <div class="grid gap-2 md:grid-cols-2">
        <ReadonlyInputField value={interactionRow.state} />
        <ReadonlyInputField value={interactionRow.input} />
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <ReadonlyCheckboxField
          checked={interactionRow.isDynamic}
          labelText={stateListsDisplay.isDynamicLabel}
        />
        <ReadonlyCheckboxField
          checked={interactionRow.recordInput}
          labelText={stateListsDisplay.recordInputLabel}
        />
      </div>
      {@render readonlyPatternRows(interactionRow.patternRows)}
    </div>
  {/each}
  {#if profileDetail.interactionRows.length === 0}
    <div
      class="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground"
    >
      {profileDetail.detailDisplay.rulesEmpty}
    </div>
  {/if}
</CollapsibleGroup>

<CollapsibleGroup
  variant="section"
  class="px-4 py-4"
  label={stateListsDisplay.transitionsTitle}
  toggle-mode="icon"
  body-class="mt-3 grid gap-2"
  persistenceKey="builtin-transitions-list"
>
  {#snippet header()}
    <div class="flex min-w-0 flex-1 items-center gap-2">
      {@render readonlySectionHeader(stateListsDisplay.transitionsTitle)}
      <span
        class="flex min-w-6 items-center justify-center rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
      >
        {profileDetail.transitionRows.length}
      </span>
    </div>
  {/snippet}

  {#each profileDetail.transitionRows as transitionRow}
    <div class="grid gap-2 rounded-lg border border-border bg-muted/40 p-3">
      <div class="grid gap-2 md:grid-cols-3">
        <ReadonlyInputField value={transitionRow.from} />
        <ReadonlyInputField value={transitionRow.command} />
        <ReadonlyInputField value={transitionRow.to} />
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <ReadonlyCheckboxField
          checked={transitionRow.isExit}
          labelText={stateListsDisplay.isExitLabel}
        />
        <ReadonlyCheckboxField
          checked={transitionRow.formatSys}
          labelText={stateListsDisplay.formatSysLabel}
        />
      </div>
    </div>
  {/each}
  {#if profileDetail.transitionRows.length === 0}
    <div
      class="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground"
    >
      {profileDetail.detailDisplay.rulesEmpty}
    </div>
  {/if}
</CollapsibleGroup>

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
  <span class="text-sm font-semibold text-slate-700">
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

<CollapsibleGroup body-class="grid gap-2" persistenceKey="builtin-prompts-list">
  {#snippet header()}
    {@render readonlySectionHeader(stateListsDisplay.promptsTitle)}
  {/snippet}

  {#each profileDetail.promptRows as promptRow}
    <div class="grid gap-2 rounded-lg border border-border bg-muted/40 p-3">
      <ReadonlyInputField value={promptRow.state} />
      {@render readonlyPatternRows(promptRow.patternRows)}
    </div>
  {/each}
</CollapsibleGroup>

<CollapsibleGroup
  body-class="grid gap-2"
  persistenceKey="builtin-sys-prompts-list"
>
  {#snippet header()}
    {@render readonlySectionHeader(stateListsDisplay.sysPromptsTitle)}
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
</CollapsibleGroup>

<CollapsibleGroup
  body-class="grid gap-2"
  persistenceKey="builtin-interactions-list"
>
  {#snippet header()}
    {@render readonlySectionHeader(stateListsDisplay.interactionsTitle)}
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
</CollapsibleGroup>

<CollapsibleGroup
  body-class="grid gap-2"
  persistenceKey="builtin-transitions-list"
>
  {#snippet header()}
    {@render readonlySectionHeader(stateListsDisplay.transitionsTitle)}
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
</CollapsibleGroup>

<script>
  import CollapsibleGroup from "../../components/fragments/CollapsibleGroup.svelte";
  import ReadonlyInputField from "../../components/fragments/ReadonlyInputField.svelte";
  import { createBuiltinProfileDetectSectionWorkspace } from "../../modules/profiles/profiles.js";

  let { profileDetail } = $props();
  const detectWorkspace = createBuiltinProfileDetectSectionWorkspace();
  let detectDisplayStateStore = $derived(
    detectWorkspace.detectDisplayStateStore,
  );
  let detectDisplay = $derived($detectDisplayStateStore);
</script>

{#snippet readonlyFieldCard(readonlyValue)}
  <div class="rounded-lg border border-border bg-muted/40 p-3">
    <ReadonlyInputField value={readonlyValue} />
  </div>
{/snippet}

{#snippet emptyReadonlyText(message)}
  <div class="text-xs text-slate-500">
    {message}
  </div>
{/snippet}

{#snippet readonlyPatternList(patternValues, hasPatternValues, emptyMessage)}
  <div class="grid gap-2">
    {#if hasPatternValues}
      {#each patternValues as patternValue}
        {@render readonlyFieldCard(patternValue)}
      {/each}
    {:else if emptyMessage}
      {@render emptyReadonlyText(emptyMessage)}
    {/if}
  </div>
{/snippet}

{#snippet detectRuleRows(detectRuleRowValues, hasDetectRuleRows)}
  <div class="grid gap-2">
    {#if hasDetectRuleRows}
      {#each detectRuleRowValues as detectRuleRow}
        <div
          class="grid gap-2 rounded-lg border border-border bg-muted/40 p-3 md:grid-cols-[1fr_120px]"
        >
          <ReadonlyInputField value={detectRuleRow.pattern} />
          <ReadonlyInputField value={detectRuleRow.weight} />
        </div>
      {/each}
    {:else}
      {@render emptyReadonlyText(detectDisplay.rulesEmpty)}
    {/if}
  </div>
{/snippet}

{#snippet detectProbeCard(detectProbeRow)}
  <div class="grid gap-3 rounded-lg border border-border bg-muted/40 p-3">
    <ReadonlyInputField value={detectProbeRow.command} />
    <div class="grid gap-2">
      <span class="text-xs font-semibold text-slate-600">
        {detectDisplay.rulesTitle}
      </span>
      {@render detectRuleRows(
        detectProbeRow.ruleRows,
        detectProbeRow.hasRuleRows,
      )}
    </div>
    <div class="grid gap-2">
      <span class="text-xs font-semibold text-slate-600">
        {detectDisplay.errorPatternsTitle}
      </span>
      {@render readonlyPatternList(
        detectProbeRow.errorPatterns,
        detectProbeRow.hasErrorPatterns,
        detectDisplay.errorPatternsEmpty,
      )}
    </div>
  </div>
{/snippet}

<CollapsibleGroup
  body-class="grid gap-3"
  persistenceKey="builtin-detect-profile-list"
>
  {#snippet header()}
    <span class="text-sm font-semibold text-slate-700">
      {detectDisplay.detectProfileTitle}
    </span>
  {/snippet}

  {#if !profileDetail.detectProfile.enabled}
    {@render emptyReadonlyText(detectDisplay.detectProfileEmpty)}
  {:else}
    <div class="grid gap-2">
      <span class="text-xs font-semibold text-slate-600">
        {detectDisplay.initialRulesTitle}
      </span>
      {@render detectRuleRows(
        profileDetail.detectProfile.initialRuleRows,
        profileDetail.detectProfile.hasInitialRuleRows,
      )}
    </div>
    <div class="grid gap-2">
      <span class="text-xs font-semibold text-slate-600">
        {detectDisplay.probesTitle}
      </span>
      <div class="grid gap-2">
        {#if profileDetail.detectProfile.hasProbeRows}
          {#each profileDetail.detectProfile.probeRows as detectProbeRow}
            {@render detectProbeCard(detectProbeRow)}
          {/each}
        {:else}
          <div class="text-xs text-slate-500">
            {detectDisplay.probesEmpty}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</CollapsibleGroup>

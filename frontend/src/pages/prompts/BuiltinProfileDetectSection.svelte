<script>
  import RadarIcon from "@lucide/svelte/icons/radar";
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
  <div
    class="rounded-lg border border-dashed border-border px-4 py-5 text-xs text-muted-foreground"
  >
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
      <span class="text-xs font-semibold text-foreground">
        {detectDisplay.rulesTitle}
      </span>
      {@render detectRuleRows(
        detectProbeRow.ruleRows,
        detectProbeRow.hasRuleRows,
      )}
    </div>
    <div class="grid gap-2">
      <span class="text-xs font-semibold text-foreground">
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

<section class="overflow-hidden rounded-lg border border-border bg-card/50">
  <header class="flex items-start gap-3 border-b border-border px-4 py-4">
    <div
      class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
    >
      <RadarIcon class="size-4" aria-hidden="true" />
    </div>
    <div class="min-w-0">
      <h3 class="text-sm font-semibold">{detectDisplay.detectProfileTitle}</h3>
      <p class="mt-1 text-xs leading-5 text-muted-foreground">
        {profileDetail.detailDisplay.detectDescription}
      </p>
    </div>
  </header>

  <div class="grid gap-4 p-4">
    {#if !profileDetail.detectProfile.enabled}
      {@render emptyReadonlyText(detectDisplay.detectProfileEmpty)}
    {:else}
      <div class="grid gap-2">
        <span class="text-xs font-semibold text-foreground">
          {detectDisplay.initialRulesTitle}
        </span>
        {@render detectRuleRows(
          profileDetail.detectProfile.initialRuleRows,
          profileDetail.detectProfile.hasInitialRuleRows,
        )}
      </div>
      <div class="grid gap-2">
        <span class="text-xs font-semibold text-foreground">
          {detectDisplay.probesTitle}
        </span>
        <div class="grid gap-2">
          {#if profileDetail.detectProfile.hasProbeRows}
            {#each profileDetail.detectProfile.probeRows as detectProbeRow}
              {@render detectProbeCard(detectProbeRow)}
            {/each}
          {:else}
            {@render emptyReadonlyText(detectDisplay.probesEmpty)}
          {/if}
        </div>
      </div>
    {/if}
  </div>
</section>
